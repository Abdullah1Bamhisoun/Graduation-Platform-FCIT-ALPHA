const { supabaseAdmin } = require('../config/supabase');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when a Supabase/PostgREST error is caused by a missing column.
 * Used for graceful fallback when the scheduled_at / calendar_event_id migration
 * has not yet been applied.
 */
function isMissingColumn(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.details || '');
  return err.code === '42703' || msg.toLowerCase().includes('does not exist');
}

/**
 * Format a Date to "Monday, 15 May 2026 – 10:00 AM" (server locale).
 */
function formatPresentationDateTime(date) {
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return `${datePart} – ${timePart}`;
}

/**
 * GET /api/presentations/student-view
 * Student-only: returns their own group number + assigned presentation time.
 * Supervisor name is intentionally excluded from this response.
 */
async function getStudentPresentationView(req, res) {
  try {
    const studentId = req.user.id;

    // Find the group this student belongs to
    const { data: membership, error: memError } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    if (memError) throw memError;

    if (!membership) {
      return res.json({ group: null, schedule: null });
    }

    const groupId = membership.group_id;

    // Fetch group info — intentionally excludes supervisor fields
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code, group_number, project_name')
      .eq('id', groupId)
      .single();

    if (groupError) throw groupError;

    // Fetch presentation schedule — excludes committee_members to hide supervisor data
    const { data: schedule, error: schedError } = await supabaseAdmin
      .from('presentation_schedules')
      .select('day, time_slot')
      .eq('group_id', groupId)
      .maybeSingle();

    if (schedError) throw schedError;

    return res.json({
      group: group
        ? {
            id: group.id,
            groupCode: group.group_code,
            groupNumber: group.group_number,
            projectName: group.project_name,
          }
        : null,
      schedule: schedule
        ? {
            day: schedule.day,
            timeSlot: schedule.time_slot,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching student presentation view:', error);
    res.status(500).json({ error: 'Failed to fetch presentation data' });
  }
}

/**
 * GET /api/presentations/by-course?courseId=<uuid>
 * Admin / Coordinator: returns all presentation schedules for a given course.
 * Coordinator is automatically scoped to their assigned course by middleware.
 */
async function getPresentationsByCourse(req, res) {
  try {
    const { courseId } = req.query;
    const isAdmin = req.user.roles.includes('admin');

    // Coordinators are restricted to their assigned course
    const effectiveCourseId = isAdmin
      ? courseId
      : req.user.coordinatorCourseId;

    if (!effectiveCourseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Coordinator scope check
    if (!isAdmin && courseId && courseId !== req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'Access denied: course scope mismatch' });
    }

    // Get all groups for this course
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code, group_number, project_name')
      .eq('course_id', effectiveCourseId)
      .order('group_number', { ascending: true });

    if (groupsError) throw groupsError;

    const groupIds = (groups || []).map((g) => g.id);

    // Get all presentation schedules for these groups
    let schedules = [];
    if (groupIds.length > 0) {
      const { data: schedData, error: schedError } = await supabaseAdmin
        .from('presentation_schedules')
        .select('group_id, day, time_slot')
        .in('group_id', groupIds);

      if (schedError) throw schedError;
      schedules = schedData || [];
    }

    const scheduleMap = new Map(schedules.map((s) => [s.group_id, s]));

    const result = (groups || []).map((g) => {
      const schedule = scheduleMap.get(g.id);
      return {
        groupId: g.id,
        groupCode: g.group_code,
        groupNumber: g.group_number,
        projectName: g.project_name,
        day: schedule?.day ?? null,
        timeSlot: schedule?.time_slot ?? null,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error fetching presentations by course:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
}

/**
 * GET /api/presentations/server-time
 * Authenticated — returns the current server UTC timestamp.
 * Used by the frontend to validate date selection against server time
 * without relying on client/browser time.
 */
async function getServerTime(req, res) {
  return res.json({ now: new Date().toISOString() });
}

/**
 * POST /api/presentations/assign
 * Admin / Coordinator — create or update a presentation schedule entry.
 *
 * Body: { groupId, scheduledAt, day, timeSlot, committeeMembers? }
 *
 * Backend enforces:
 *  - scheduledAt must be a valid future ISO datetime (vs server time).
 *  - Coordinator is scoped to their assigned course.
 *  - Auto-creates / updates a linked calendar event.
 *  - Auto-creates an announcement with the formatted real date and time.
 *
 * Gracefully falls back if the scheduled_at / calendar_event_id columns have
 * not yet been migrated (column missing → store day/time_slot only).
 */
async function assignSchedule(req, res) {
  try {
    const { groupId, scheduledAt, day, timeSlot, committeeMembers } = req.body;
    const isAdmin = (req.user.roles || []).includes('admin');

    // ── Validate required fields ───────────────────────────────────────────
    if (!groupId || !scheduledAt || !day || !timeSlot) {
      return res.status(400).json({
        error: 'groupId, scheduledAt, day, and timeSlot are required',
      });
    }

    // ── Validate scheduledAt against server time ───────────────────────────
    const presentationDate = new Date(scheduledAt);
    if (isNaN(presentationDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt: must be an ISO datetime string' });
    }
    const now = new Date();
    if (presentationDate <= now) {
      return res.status(400).json({
        error: 'Presentation date must be in the future',
        serverTime: now.toISOString(),
      });
    }

    // ── Coordinator scope: group must belong to their course ──────────────
    if (!isAdmin) {
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .single();
      if (grpErr || !grp) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (grp.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({
          error: 'Access denied: group does not belong to your assigned course',
        });
      }
    }

    // ── Fetch group info for announcement text ─────────────────────────────
    const { data: groupData } = await supabaseAdmin
      .from('groups')
      .select('project_name, group_code, group_number')
      .eq('id', groupId)
      .single();
    const projectName = groupData?.project_name ?? 'Unknown Project';

    // ── Fetch existing schedule to get linked calendar_event_id ───────────
    const { data: existing } = await supabaseAdmin
      .from('presentation_schedules')
      .select('calendar_event_id')
      .eq('group_id', groupId)
      .maybeSingle();
    const existingCalendarEventId = existing?.calendar_event_id ?? null;

    // ── Create or update linked calendar event ─────────────────────────────
    const calendarPayload = {
      title: `Presentation: ${projectName}`,
      date: presentationDate.toISOString().slice(0, 10), // YYYY-MM-DD
      type: 'presentation',
      time: timeSlot,
    };
    let calendarEventId = existingCalendarEventId;

    if (existingCalendarEventId) {
      await supabaseAdmin
        .from('calendar_events')
        .update(calendarPayload)
        .eq('id', existingCalendarEventId)
        .catch((err) => console.warn('[presentations] Failed to update calendar event:', err));
    } else {
      const { data: calEvt, error: calErr } = await supabaseAdmin
        .from('calendar_events')
        .insert(calendarPayload)
        .select('id')
        .single();
      if (!calErr && calEvt) calendarEventId = calEvt.id;
    }

    // ── Upsert presentation schedule ───────────────────────────────────────
    // Try with new columns; fall back if migration not yet applied.
    const fullPayload = {
      group_id: groupId,
      day,
      time_slot: timeSlot,
      committee_members: committeeMembers ?? [],
      scheduled_at: presentationDate.toISOString(),
      calendar_event_id: calendarEventId,
    };
    let { error: upsertErr } = await supabaseAdmin
      .from('presentation_schedules')
      .upsert(fullPayload, { onConflict: 'group_id' });

    if (upsertErr && isMissingColumn(upsertErr)) {
      console.warn('[presentations] scheduled_at/calendar_event_id columns missing — run migration. Storing without them.');
      ({ error: upsertErr } = await supabaseAdmin
        .from('presentation_schedules')
        .upsert(
          { group_id: groupId, day, time_slot: timeSlot, committee_members: committeeMembers ?? [] },
          { onConflict: 'group_id' }
        ));
    }
    if (upsertErr) throw upsertErr;

    // ── Auto-create announcement ───────────────────────────────────────────
    const formatted = formatPresentationDateTime(presentationDate);
    const announcementContent = [
      `A presentation slot has been assigned for ${projectName}.`,
      '',
      `${formatted}`,
      `Slot: ${day} – ${timeSlot}`,
    ].join('\n');

    await supabaseAdmin.from('announcements').insert({
      title: `Presentation Assigned: ${projectName}`,
      content: announcementContent,
      author_id: req.user.id,
      target_roles: ['student', 'supervisor', 'coordinator'],
      published_at: new Date().toISOString(),
      expires_at: null,
    }).catch((err) => console.warn('[presentations] Failed to create announcement:', err));

    return res.json({ success: true });
  } catch (error) {
    console.error('Error assigning presentation schedule:', error);
    res.status(500).json({ error: 'Failed to assign presentation schedule' });
  }
}

/**
 * DELETE /api/presentations/schedule/:groupId
 * Admin / Coordinator — remove a presentation schedule and its linked calendar event.
 */
async function deleteSchedule(req, res) {
  try {
    const { groupId } = req.params;
    const isAdmin = (req.user.roles || []).includes('admin');

    // Fetch existing schedule
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('presentation_schedules')
      .select('calendar_event_id')
      .eq('group_id', groupId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    // Coordinator scope check
    if (!isAdmin) {
      const { data: grp } = await supabaseAdmin
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .single();
      if (!grp || grp.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Delete linked calendar event
    if (existing.calendar_event_id) {
      await supabaseAdmin
        .from('calendar_events')
        .delete()
        .eq('id', existing.calendar_event_id)
        .catch((err) => console.warn('[presentations] Failed to delete linked calendar event:', err));
    }

    // Delete the schedule row
    const { error: delErr } = await supabaseAdmin
      .from('presentation_schedules')
      .delete()
      .eq('group_id', groupId);
    if (delErr) throw delErr;

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting presentation schedule:', error);
    res.status(500).json({ error: 'Failed to delete presentation schedule' });
  }
}

module.exports = {
  getStudentPresentationView,
  getPresentationsByCourse,
  getServerTime,
  assignSchedule,
  deleteSchedule,
};
