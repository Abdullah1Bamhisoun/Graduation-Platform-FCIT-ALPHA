const { supabaseAdmin } = require('../config/supabase');

/** True when a Supabase/PostgREST error is caused by a missing column */
function isMissingCourseIdColumn(err) {
  if (!err) return false;
  const msg = err.message || err.details || '';
  return msg.includes('course_id') && (err.code === '42703' || msg.includes('does not exist'));
}

/**
 * GET /api/calendar-events
 * Authenticated — returns calendar events.
 * - Admin: all events
 * - Coordinator: only events for their assigned course (course_id = coordinatorCourseId)
 * - Others: all events
 *
 * Falls back gracefully if course_id column has not been migrated yet.
 */
async function listEvents(req, res) {
  try {
    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const coordinatorCourseId = req.user.coordinatorCourseId;

    // ── Attempt 1: with course_id column ─────────────────────────────────────
    let query = supabaseAdmin
      .from('calendar_events')
      .select('id, title, date, type, time, location, course_id, created_at')
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

    if (error) throw error;

    res.json((data || []).map((e) => ({
      id: e.id,
      title: e.title,
      date: e.date,
      type: e.type,
      time: e.time ?? undefined,
      location: e.location ?? undefined,
      courseId: e.course_id ?? undefined,
    })));
  } catch (error) {
    console.error('Error listing calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
}

/**
 * POST /api/calendar-events
 * Coordinator or Admin — create a new calendar event.
 * Coordinators automatically have their assigned course_id applied.
 *
 * Falls back gracefully if course_id column has not been migrated yet.
 */
async function createEvent(req, res) {
  try {
    const { title, date, type, time, location } = req.body;

    if (!title || !date || !type) {
      return res.status(400).json({ error: 'title, date, and type are required' });
    }

    const isAdmin = req.user.roles && req.user.roles.includes('admin');
    const courseId = isAdmin ? null : (req.user.coordinatorCourseId || null);

    if (!isAdmin && !courseId) {
      return res.status(403).json({ error: 'No course assigned to your coordinator account. Please contact the admin.' });
    }

    const baseInsert = {
      title,
      date,
      type,
      time: time || null,
      location: location || null,
    };

    // ── Attempt 1: with course_id ─────────────────────────────────────────────
    let { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert(courseId ? { ...baseInsert, course_id: courseId } : baseInsert)
      .select('id')
      .single();

    // ── Fallback: course_id column not yet added ──────────────────────────────
    if (isMissingCourseIdColumn(error)) {
      console.warn('[calendar-events] course_id column missing — run migration. Inserting without course scope.');
      ({ data, error } = await supabaseAdmin
        .from('calendar_events')
        .insert(baseInsert)
        .select('id')
        .single());
    }

    if (error) throw error;

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
      : ['student', 'supervisor'];

    await supabaseAdmin.from('announcements').insert({
      title: `New Event: ${title}`,
      content: announcementLines,
      author_id: req.user.id,
      target_roles: targetRoles,
      published_at: new Date().toISOString(),
      expires_at: null,
    }).catch((err) => console.warn('Failed to auto-create announcement for event:', err));

    res.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
}

/**
 * DELETE /api/calendar-events/:id
 * Coordinator or Admin — delete a calendar event.
 * Coordinators can only delete events belonging to their assigned course.
 *
 * Falls back gracefully if course_id column has not been migrated yet.
 */
async function deleteEvent(req, res) {
  try {
    const { id } = req.params;
    const isAdmin = req.user.roles && req.user.roles.includes('admin');

    if (!isAdmin) {
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('calendar_events')
        .select('course_id')
        .eq('id', id)
        .single();

      // If course_id column doesn't exist yet, allow the delete (migration pending)
      if (fetchError && isMissingCourseIdColumn(fetchError)) {
        // fall through to delete
      } else if (fetchError || !existing) {
        return res.status(404).json({ error: 'Event not found' });
      } else if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied: event does not belong to your course' });
      }
    }

    const { error } = await supabaseAdmin.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
}

module.exports = { listEvents, createEvent, deleteEvent };
