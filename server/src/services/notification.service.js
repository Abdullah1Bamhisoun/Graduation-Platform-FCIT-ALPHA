/**
 * Notification Service
 *
 * Central fire-and-forget helpers for auto-creating:
 *   - Announcements  (role+course scoped, shown in the Announcements page)
 *   - Notifications  (per-user, shown in the bell icon)
 *   - Calendar events  (course-scoped or per-user personal)
 *
 * All exported functions are async but NEVER throw — errors are caught and
 * logged so that a notification failure never blocks an HTTP response.
 *
 * Usage pattern in controllers:
 *   ;(async () => {
 *     try {
 *       await notificationService.createAnnouncement({ ... });
 *       await notificationService.createUserNotifications([id], { ... });
 *     } catch (e) { console.error('[ctx] notification error:', e.message); }
 *   })();
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');

// ─── Announcements ────────────────────────────────────────────────────────────

/**
 * Insert a role-scoped announcement record.
 *
 * @param {object} opts
 * @param {string}   opts.title
 * @param {string}   opts.content
 * @param {string[]} opts.targetRoles  e.g. ['supervisor'] or ['student']
 * @param {string|null} opts.courseId  UUID of the course (null = platform-wide)
 * @param {string|null} [opts.groupId] UUID of the group (null = course-wide; set for group-specific announcements)
 * @param {string|null} opts.authorId  UUID of the actor (null → system)
 * @param {string|null} [opts.expiresAt]
 * @returns {Promise<{id: string}|null>}
 */
async function createAnnouncement({ title, content, targetRoles, courseId, groupId = null, authorId, expiresAt = null }) {
  try {
    const base = {
      title,
      content,
      author_id:    authorId,
      target_roles: targetRoles,
      published_at: new Date().toISOString(),
      expires_at:   expiresAt ?? null,
    };

    // Build the full payload: try with course_id + group_id (migrations 005+006).
    // Fall back progressively if columns don't exist yet.
    const withCourseAndGroup = courseId
      ? { ...base, course_id: courseId, ...(groupId ? { group_id: groupId } : {}) }
      : base;

    let result = await supabaseAdmin.from('announcements').insert(withCourseAndGroup).select('id').single();

    if (result.error && groupId) {
      // group_id column missing (migration 006 not applied) — retry without it
      const withCourseOnly = courseId ? { ...base, course_id: courseId } : base;
      result = await supabaseAdmin.from('announcements').insert(withCourseOnly).select('id').single();
    }

    if (result.error && courseId) {
      // course_id column missing (migration 005 not applied) — retry without it
      result = await supabaseAdmin.from('announcements').insert(base).select('id').single();
    }

    if (result.error) {
      console.error('[notification.service] createAnnouncement error:', result.error.message);
      return null;
    }

    return result.data;
  } catch (err) {
    console.error('[notification.service] createAnnouncement exception:', err.message);
    return null;
  }
}

// ─── Per-user Notifications ───────────────────────────────────────────────────

/**
 * Insert one notification record per userId into the `notifications` table.
 *
 * @param {string[]} userIds
 * @param {object}   opts
 * @param {string}   opts.type     e.g. 'submission' | 'grade' | 'feedback' | 'presentation' | 'announcement'
 * @param {string}   opts.title
 * @param {string}   opts.message
 * @param {string|null} [opts.link]
 * @returns {Promise<void>}
 */
async function createUserNotifications(userIds, { type, title, message, link = null }) {
  if (!userIds || userIds.length === 0) return;

  try {
    const rows = userIds.map((userId) => ({
      user_id: userId,
      type,
      title,
      message,
      link: link ?? null,
      read: false,
    }));

    const { error } = await supabaseAdmin.from('notifications').insert(rows);
    if (error) {
      console.error('[notification.service] createUserNotifications error:', error.message);
    }
  } catch (err) {
    console.error('[notification.service] createUserNotifications exception:', err.message);
  }
}

// ─── Calendar Events ──────────────────────────────────────────────────────────

/**
 * Insert a course-scoped calendar event (visible to all users in the course).
 *
 * @param {object} opts
 * @param {string}      opts.title
 * @param {string}      opts.date       YYYY-MM-DD
 * @param {string}      opts.type       'deadline' | 'demo' | 'presentation' | 'meeting'
 * @param {string|null} [opts.time]
 * @param {string|null} [opts.location]
 * @param {string|null} [opts.courseId]
 * @returns {Promise<{id: string}|null>}
 */
async function createCalendarEvent({ title, date, type, time = null, location = null, courseId = null }) {
  try {
    const payload = {
      title,
      date,
      type,
      time:      time     ?? null,
      location:  location ?? null,
    };
    if (courseId) payload.course_id = courseId;

    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error('[notification.service] createCalendarEvent error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[notification.service] createCalendarEvent exception:', err.message);
    return null;
  }
}

/**
 * Insert a personal calendar event visible only to one user.
 * Requires migration 012 (user_id column on calendar_events).
 * Falls back gracefully if the column doesn't exist yet.
 *
 * @param {object} opts
 * @param {string}      opts.title
 * @param {string}      opts.date       YYYY-MM-DD
 * @param {string}      opts.type
 * @param {string|null} [opts.time]
 * @param {string|null} [opts.location]
 * @param {string}      opts.userId     UUID of the recipient
 * @returns {Promise<{id: string}|null>}
 */
async function createPersonalCalendarEvent({ title, date, type, time = null, location = null, userId }) {
  if (!userId) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('calendar_events')
      .insert({ title, date, type, time: time ?? null, location: location ?? null, user_id: userId })
      .select('id')
      .single();

    if (error) {
      // If user_id column doesn't exist yet (migration 012 not applied), log and skip
      const isMissingColumn = error.code === '42703' || (error.message || '').includes('does not exist');
      if (isMissingColumn) {
        console.warn('[notification.service] createPersonalCalendarEvent: user_id column missing — run migration 012.');
        return null;
      }
      console.error('[notification.service] createPersonalCalendarEvent error:', error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[notification.service] createPersonalCalendarEvent exception:', err.message);
    return null;
  }
}

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/**
 * Fetch all members of a group with their id, name, and email.
 *
 * @param {string} groupId
 * @returns {Promise<Array<{id: string, name: string, email: string}>>}
 */
async function getGroupMembers(groupId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('group_members')
      .select('student_id, student:profiles!student_id(id, name, email)')
      .eq('group_id', groupId);

    if (error) {
      console.error('[notification.service] getGroupMembers error:', error.message);
      return [];
    }

    return (data || [])
      .map((row) => ({
        id:    row.student?.id    ?? row.student_id,
        name:  row.student?.name  ?? '',
        email: row.student?.email ?? '',
      }))
      .filter((m) => m.id);
  } catch (err) {
    console.error('[notification.service] getGroupMembers exception:', err.message);
    return [];
  }
}

/**
 * Fetch the supervisor of a group (id, name, email), or null if unassigned.
 *
 * @param {string} groupId
 * @returns {Promise<{id: string, name: string, email: string}|null>}
 */
async function getSupervisorOfGroup(groupId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .select('supervisor_id, supervisor:profiles!supervisor_id(id, name, email)')
      .eq('id', groupId)
      .single();

    if (error || !data?.supervisor_id) return null;

    return {
      id:    data.supervisor?.id    ?? data.supervisor_id,
      name:  data.supervisor?.name  ?? '',
      email: data.supervisor?.email ?? '',
    };
  } catch (err) {
    console.error('[notification.service] getSupervisorOfGroup exception:', err.message);
    return null;
  }
}

/**
 * Fetch the course_id for a group.
 *
 * @param {string} groupId
 * @returns {Promise<string|null>}
 */
async function getCourseIdFromGroup(groupId) {
  try {
    const { data, error } = await supabaseAdmin
      .from('groups')
      .select('course_id')
      .eq('id', groupId)
      .single();

    if (error || !data) return null;
    return data.course_id ?? null;
  } catch (err) {
    console.error('[notification.service] getCourseIdFromGroup exception:', err.message);
    return null;
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createAnnouncement,
  createUserNotifications,
  createCalendarEvent,
  createPersonalCalendarEvent,
  getGroupMembers,
  getSupervisorOfGroup,
  getCourseIdFromGroup,
};
