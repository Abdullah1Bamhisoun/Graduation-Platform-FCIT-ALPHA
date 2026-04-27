const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDelPattern, TTL } = require('../utils/cache');

/** True when a Supabase/PostgREST error is caused by a missing column */
function isMissingCourseIdColumn(err) {
  if (!err) return false;
  const msg = err.message || err.details || '';
  return msg.includes('course_id') && (err.code === '42703' || msg.includes('does not exist'));
}

/** True when the error is caused by the table not existing yet (PostgreSQL: undefined_table) */
function isMissingTable(err) {
  if (!err) return false;
  return err.code === '42P01';
}

/**
 * GET /api/calendar-events
 * Authenticated — returns calendar events.
 * - Admin: all events
 * - Coordinator: only events for their assigned course (course_id = coordinatorCourseId)
 * - Supervisor: non-presentation events + only presentation events where they are a committee member
 * - Student: non-presentation events + only the presentation event linked to their group
 * - Others: all events
 *
 * Falls back gracefully if course_id column has not been migrated yet.
 */
async function listEvents(req, res) {
  try {
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const isStudent = !isAdmin && req.user.roles && req.user.roles.includes('student');
    const isSupervisor = !isAdmin && req.user.roles && req.user.roles.includes('supervisor');
    const coordinatorCourseId = req.user.coordinatorCourseId;

    // Calendar events are scoped per-user (students get personal events too),
    // so cache per userId to avoid cross-user data leaks.
    const calendarCk = `calendar:${req.user.id}`;
    const cachedEvents = await cacheGet(calendarCk);
    if (cachedEvents) return res.json(cachedEvents);

    // ── Attempt 1: with course_id + group_id columns ─────────────────────────
    let query = supabaseAdmin
      .from('calendar_events')
      .select('id, title, date, type, time, location, course_id, group_id, created_at')
      .order('date', { ascending: true });

    if (!isAdmin && coordinatorCourseId) {
      query = query.eq('course_id', coordinatorCourseId);
    }

    let { data, error } = await query;

    // ── Fallback: course_id column not yet added (migration pending) ──────────
    if (isMissingCourseIdColumn(error)) {
      ({ data, error } = await supabaseAdmin
        .from('calendar_events')
        .select('id, title, date, type, time, location, created_at')
        .order('date', { ascending: true }));
    }

    // ── Fallback: table doesn't exist yet ─────────────────────────────────────
    if (isMissingTable(error)) {
      return res.json([]);
    }

    if (error) throw error;

    let events = data || [];

    // ── Filter presentation events for students ───────────────────────────────
    // Students should only see the presentation event for their own group.
    if (isStudent && !coordinatorCourseId) {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('student_id', req.user.id)
        .maybeSingle();

      const allowedPresentationEventIds = new Set();
      if (membership?.group_id) {
        const { data: schedule } = await supabaseAdmin
          .from('presentation_schedules')
          .select('calendar_event_id')
          .eq('group_id', membership.group_id)
          .maybeSingle();
        if (schedule?.calendar_event_id) {
          allowedPresentationEventIds.add(schedule.calendar_event_id);
        }
      }

      events = events.filter(
        (e) => e.type !== 'presentation' || allowedPresentationEventIds.has(e.id)
      );
    }

    // ── Filter presentation events for supervisors ────────────────────────────
    // Supervisors should only see presentation events where they are a committee member.
    if (isSupervisor && !coordinatorCourseId) {
      const supervisorName = req.user.name;
      const { data: schedules } = await supabaseAdmin
        .from('presentation_schedules')
        .select('calendar_event_id, committee_members')
        .not('calendar_event_id', 'is', null);

      const allowedPresentationEventIds = new Set(
        (schedules || [])
          .filter(
            (s) =>
              Array.isArray(s.committee_members) &&
              s.committee_members.includes(supervisorName)
          )
          .map((s) => s.calendar_event_id)
          .filter(Boolean)
      );

      events = events.filter(
        (e) => e.type !== 'presentation' || allowedPresentationEventIds.has(e.id)
      );
    }

    // ── Merge personal (user_id-scoped) calendar events ──────────────────────
    // These are events created specifically for this user (e.g. "Review submission
    // from Group X" visible only to that supervisor). Requires migration 012.
    // Falls back gracefully if user_id column doesn't exist yet.
    try {
      const { data: personalEvents, error: peErr } = await supabaseAdmin
        .from('calendar_events')
        .select('id, title, date, type, time, location, course_id, user_id, created_at')
        .eq('user_id', req.user.id)
        .order('date', { ascending: true });

      const isMissingUserIdCol = peErr && (
        peErr.code === '42703' || (peErr.message || '').includes('does not exist')
      );

      if (!isMissingUserIdCol && !peErr && personalEvents && personalEvents.length > 0) {
        // Merge + deduplicate by id (a personal event shouldn't also appear in course events,
        // but guard just in case), then re-sort chronologically.
        const mergedMap = new Map(events.map((e) => [e.id, e]));
        for (const pe of personalEvents) mergedMap.set(pe.id, pe);
        events = [...mergedMap.values()].sort((a, b) => {
          if (a.date < b.date) return -1;
          if (a.date > b.date) return 1;
          return 0;
        });
      }
    } catch (_) {
      // Non-fatal — personal events are best-effort
    }

    const calendarPayload = events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      type: e.type,
      time: e.time ?? undefined,
      location: e.location ?? undefined,
      courseId: e.course_id ?? undefined,
      groupId: e.group_id ?? undefined,
    }));

    await cacheSet(calendarCk, calendarPayload, TTL.SHORT);
    res.json(calendarPayload);
  } catch (error) {
    console.error('Error listing calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}

/**
 * POST /api/calendar-events
 * Supervisor/Coordinator/Admin — create a new calendar event.
 * - Coordinators: event is scoped to their assigned course.
 * - Supervisors: must supply a groupId; event is scoped to that group.
 * - Admins: platform-wide (no course scope unless explicitly provided).
 *
 * Falls back gracefully if course_id / group_id column has not been migrated yet.
 */
async function createEvent(req, res) {
  try {
    const { title, date, type, time, location, groupId } = req.body;

    if (!title || !date || !type) {
      return res.status(400).json({ error: 'title, date, and type are required' });
    }

    const isAdmin        = req.user.roles && req.user.roles.includes('admin');
    const isCoordinator  = !isAdmin && !!req.user.coordinatorCourseId;
    const isSupervisor   = !isAdmin && !isCoordinator && req.user.roles && req.user.roles.includes('supervisor');

    let courseId     = null;
    let resolvedGroupId = null;

    if (isAdmin) {
      // Admin: no forced scope
    } else if (isSupervisor) {
      // Supervisor must provide a groupId and must supervise that group
      if (!groupId) {
        return res.status(400).json({ error: 'groupId is required for supervisor-created events' });
      }
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('id, course_id')
        .eq('id', groupId)
        .eq('supervisor_id', req.user.id)
        .maybeSingle();

      if (grpErr || !grp) {
        return res.status(403).json({ error: 'You are not the supervisor of this group' });
      }
      resolvedGroupId = grp.id;
      courseId        = grp.course_id ?? null;
    } else {
      // Coordinator
      courseId = req.user.coordinatorCourseId || null;
      if (!courseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account. Please contact the admin.' });
      }
    }

    const baseInsert = {
      title,
      date,
      type,
      time: time || null,
      location: location || null,
    };

    const fullInsert = {
      ...baseInsert,
      ...(courseId        ? { course_id: courseId }         : {}),
      ...(resolvedGroupId ? { group_id:  resolvedGroupId }  : {}),
    };

    // ── Attempt 1: with course_id + group_id (migrations 005+006) ────────────
    let { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert(fullInsert)
      .select('id')
      .single();

    // ── Fallback: group_id column missing ────────────────────────────────────
    if (error && resolvedGroupId) {
      ({ data, error } = await supabaseAdmin
        .from('calendar_events')
        .insert({ ...baseInsert, ...(courseId ? { course_id: courseId } : {}) })
        .select('id')
        .single());
    }

    // ── Fallback: course_id column not yet added ──────────────────────────────
    if (isMissingCourseIdColumn(error)) {
      console.warn('[calendar-events] course_id column missing — run migration. Inserting without course scope.');
      ({ data, error } = await supabaseAdmin
        .from('calendar_events')
        .insert(baseInsert)
        .select('id')
        .single());
    }

    // ── Table does not exist ──────────────────────────────────────────────────
    if (isMissingTable(error)) {
      console.error('[calendar-events] The calendar_events table does not exist. Run the migration script: node scripts/create-calendar-events-table.js');
      return res.status(503).json({ error: 'Calendar events table is not set up. Please contact the administrator.' });
    }

    if (error) {
      console.error('[calendar-events] DB error on insert:', error);
      throw error;
    }

    // ── Auto-create announcement ──────────────────────────────────────────────
    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const announcementLines = [
      `A new ${type} event has been added to the calendar.`,
      '',
      `Date: ${formattedDate}`,
      time     ? `Time: ${time}`         : null,
      location ? `Location: ${location}` : null,
    ].filter((l) => l !== null).join('\n');

    const targetRoles = isAdmin
      ? ['student', 'supervisor', 'coordinator']
      : isSupervisor
        ? ['student']                          // supervisor events target their group's students
        : ['student', 'supervisor'];

    try {
      const annPayload = {
        title:        `New Event: ${title}`,
        content:      announcementLines,
        author_id:    req.user.id,
        target_roles: targetRoles,
        published_at: new Date().toISOString(),
        expires_at:   null,
        ...(courseId        ? { course_id: courseId }        : {}),
        ...(resolvedGroupId ? { group_id:  resolvedGroupId } : {}),
      };
      await supabaseAdmin.from('announcements').insert(annPayload);
    } catch (annErr) {
      console.warn('Failed to auto-create announcement for event:', annErr);
    }

    await cacheDelPattern('calendar:*');
    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    const detail = error?.message || error?.details || '';
    res.status(500).json({
      error: detail
        ? `Failed to create calendar event: ${detail}`
        : 'Failed to create calendar event',
    });
  }
}

/**
 * DELETE /api/calendar-events/:id
 * Supervisor/Coordinator/Admin — delete a calendar event.
 * - Coordinators can only delete events belonging to their assigned course.
 * - Supervisors can only delete events scoped to their own groups.
 * - Admins can delete any event.
 *
 * Falls back gracefully if course_id column has not been migrated yet.
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const isAdmin       = req.user.roles && req.user.roles.includes('admin');
    const isCoordinator = !isAdmin && !!req.user.coordinatorCourseId;
    const isSupervisor  = !isAdmin && !isCoordinator && req.user.roles && req.user.roles.includes('supervisor');

    if (!isAdmin) {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('calendar_events')
        .select('course_id, group_id')
        .eq('id', id)
        .maybeSingle();

      // If course_id column doesn't exist yet, allow the delete (migration pending)
      if (fetchError && isMissingCourseIdColumn(fetchError)) {
        // fall through to delete
      } else if (fetchError || !existing) {
        return res.status(404).json({ error: 'Event not found' });
      } else if (isSupervisor) {
        // Supervisor can only delete an event that is scoped to one of their groups
        if (!existing.group_id) {
          return res.status(403).json({ error: 'Access denied: you can only delete events you created for your groups' });
        }
        const { data: grp } = await supabaseAdmin
          .from('groups')
          .select('id')
          .eq('id', existing.group_id)
          .eq('supervisor_id', req.user.id)
          .maybeSingle();
        if (!grp) {
          return res.status(403).json({ error: 'Access denied: this event does not belong to your group' });
        }
      } else if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied: event does not belong to your course' });
      }
    }

    // Clear any presentation_schedules row that references this calendar event.
    // This prevents a FK constraint violation when the live DB has a FK on
    // presentation_schedules.calendar_event_id → calendar_events(id).
    // Wrapped in try/catch so a missing column (migration not yet applied)
    // does not block the delete.
    try {
      await supabaseAdmin
        .from('presentation_schedules')
        .update({ calendar_event_id: null })
        .eq('calendar_event_id', id);
    } catch (_) {
      // best-effort – ignore if column doesn't exist yet
    }

    const { error } = await supabaseAdmin.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
    await cacheDelPattern('calendar:*');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
}

module.exports = { listEvents, createEvent, deleteEvent };
