const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');

/**
 * Seed closed rows for a course type if the table is empty for it.
 * Tries 16 weeks; falls back to 14 if the DB has a stricter check constraint.
 */
async function ensureSeeded(courseType) {
  // Fetch existing week numbers so we can insert only the missing ones
  const { data: existing } = await supabaseAdmin
    .from('week_statuses')
    .select('week_number')
    .eq('course_type', courseType);

  const existingNums = new Set((existing || []).map((r) => r.week_number));
  const missing = Array.from({ length: 16 }, (_, i) => i + 1).filter((n) => !existingNums.has(n));

  if (missing.length === 0) return; // all 16 weeks already exist

  const rows = missing.map((n) => ({
    course_type: courseType,
    week_number: n,
    is_open:     false,
    was_opened:  false,
  }));

  const { error } = await supabaseAdmin
    .from('week_statuses')
    .insert(rows);

  if (error) console.error(`Seed error for ${courseType} (missing weeks ${missing.join(',')}):`, error.message);
}

/**
 * GET /api/week-statuses?courseType=498
 * Returns all 16 week statuses for a course type.
 * Auto-seeds rows on first access.
 */
async function getWeekStatuses(req, res) {
  try {
    const { courseType } = req.query;

    if (!courseType || !['498', '499'].includes(courseType)) {
      return res.status(400).json({ error: 'courseType must be 498 or 499' });
    }

    await ensureSeeded(courseType);

    const { data, error } = await supabaseAdmin
      .from('week_statuses')
      .select('*')
      .eq('course_type', courseType)
      .order('week_number');

    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching week statuses:', JSON.stringify(err));
    res.status(500).json({ error: 'Failed to fetch week statuses' });
  }
}

/**
 * PATCH /api/week-statuses/:id/open
 * Opens a week and marks was_opened = true (permanent record).
 */
async function openWeek(req, res) {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    // Try with was_opened; fall back without it if column doesn't exist
    const { error: err1 } = await supabaseAdmin
      .from('week_statuses')
      .update({ is_open: true, was_opened: true, updated_by: updatedBy })
      .eq('id', id);

    if (err1?.code === '42703' || err1?.message?.includes('was_opened')) {
      const { error: err2 } = await supabaseAdmin
        .from('week_statuses')
        .update({ is_open: true, updated_by: updatedBy })
        .eq('id', id);
      if (err2) throw err2;
    } else if (err1) {
      throw err1;
    }

    // Fetch data needed for email before responding
    const { data: weekRow } = await supabaseAdmin
      .from('week_statuses').select('week_number, course_type').eq('id', id).single();

    res.json({ success: true });

    if (!weekRow) { console.warn('[weekStatuses] weekRow not found for id:', id); return; }

    // Send email to students on every open/reopen (best-effort, non-blocking)
    ;(async () => {
      try {
        const emails = await getStudentEmailsForCourseType(weekRow.course_type);
        if (emails.length === 0) {
          console.warn('[weekStatuses] No student emails found for course type:', weekRow.course_type);
          return;
        }
        await emailService.sendWeekOpened(emails, {
          weekNumber: weekRow.week_number,
          courseType: weekRow.course_type,
        });
        console.log(`[weekStatuses] Week-opened email sent to ${emails.length} student(s) for week ${weekRow.week_number}`);
      } catch (e) {
        console.error('[weekStatuses] Failed to send week-opened emails:', e);
      }
    })();
  } catch (err) {
    console.error('Error opening week:', err);
    res.status(500).json({ error: 'Failed to open week' });
  }
}

/**
 * PATCH /api/week-statuses/:id/close
 * Closes a week. If is_locked column exists, refuses to close a locked week.
 */
async function closeWeek(req, res) {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    // Check lock status — skip if column doesn't exist yet
    const { data: row, error: readErr } = await supabaseAdmin
      .from('week_statuses')
      .select('is_locked')
      .eq('id', id)
      .single();

    const colMissing = readErr?.code === '42703' || readErr?.message?.includes('is_locked');
    if (readErr && !colMissing) throw readErr;
    if (!colMissing && row?.is_locked) {
      return res.status(400).json({ error: 'Cannot close a locked week.' });
    }

    const { error } = await supabaseAdmin
      .from('week_statuses')
      .update({ is_open: false, updated_by: updatedBy })
      .eq('id', id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error closing week:', err);
    res.status(500).json({ error: 'Failed to close week' });
  }
}

/**
 * PATCH /api/week-statuses/:id/lock
 * Locks a week permanently. Requires is_locked column in DB.
 */
async function lockWeek(req, res) {
  try {
    const { id } = req.params;
    const updatedBy = req.user?.id;

    const { data, error: readErr } = await supabaseAdmin
      .from('week_statuses')
      .select('was_opened')
      .eq('id', id)
      .single();

    if (readErr) throw readErr;
    if (!data?.was_opened) {
      return res.status(400).json({ error: 'Cannot lock a week that was never opened.' });
    }

    // Build update — only include is_locked if the column exists
    const updatePayload = { is_open: false, updated_by: updatedBy };
    const { error: lockErr } = await supabaseAdmin
      .from('week_statuses')
      .update({ ...updatePayload, is_locked: true })
      .eq('id', id);

    if (lockErr?.code === '42703' || lockErr?.message?.includes('is_locked')) {
      // Column doesn't exist — close without locking
      const { error } = await supabaseAdmin
        .from('week_statuses')
        .update(updatePayload)
        .eq('id', id);
      if (error) throw error;
      return res.json({ success: true, note: 'Locked flag not set (add is_locked column via SQL)' });
    }

    if (lockErr) throw lockErr;
    res.json({ success: true });
  } catch (err) {
    console.error('Error locking week:', err);
    res.status(500).json({ error: 'Failed to lock week' });
  }
}

/**
 * PATCH /api/week-statuses/:id/deadline
 * Sets open_at and/or close_at for a week's submission window.
 * Only coordinators and admins may call this.
 *
 * Body: { open_at?: string (ISO 8601), close_at?: string (ISO 8601) }
 */
async function setDeadline(req, res) {
  try {
    const { id } = req.params;
    const { open_at, close_at } = req.body;
    const updatedBy = req.user?.id;

    // Both undefined means no body fields at all — reject
    if (open_at === undefined && close_at === undefined) {
      return res.status(400).json({ error: 'Provide at least one of open_at or close_at.' });
    }

    if (open_at && close_at && new Date(open_at) >= new Date(close_at)) {
      return res.status(400).json({ error: 'open_at must be before close_at.' });
    }

    // Explicit null clears the column; omitted fields are left unchanged
    const payload = { updated_by: updatedBy };
    if (open_at  !== undefined) payload.open_at  = open_at  || null;
    if (close_at !== undefined) payload.close_at = close_at || null;

    const { error } = await supabaseAdmin
      .from('week_statuses')
      .update(payload)
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });

    // Schedule pre-deadline reminder email (best-effort, non-blocking)
    if (close_at) {
      ;(async () => {
        try {
          const deadline = new Date(close_at);
          const reminderTime = new Date(deadline.getTime() - 24 * 60 * 60 * 1000);
          const msUntilReminder = reminderTime.getTime() - Date.now();

          if (msUntilReminder <= 0) return; // deadline already within 24 h or passed

          const { data: weekRow } = await supabaseAdmin
            .from('week_statuses')
            .select('week_number, course_type')
            .eq('id', id)
            .single();

          if (!weekRow) return;

          setTimeout(async () => {
            try {
              const emails = await getStudentEmailsForCourseType(weekRow.course_type);
              if (emails.length === 0) return;
              await emailService.sendDeadlineReminder(emails, {
                weekNumber: weekRow.week_number,
                courseType: weekRow.course_type,
                closeAt: close_at,
              });
            } catch (e) {
              console.error('[weekStatuses] Failed to send deadline-reminder emails:', e);
            }
          }, msUntilReminder);
        } catch (e) {
          console.error('[weekStatuses] Error scheduling deadline reminder:', e);
        }
      })();
    }
  } catch (err) {
    console.error('Error setting deadline:', err);
    res.status(500).json({ error: 'Failed to set deadline' });
  }
}

/**
 * Resolves all student emails for a given course type (498 or 499).
 * @param {string} courseType
 * @returns {Promise<string[]>}
 */
async function getStudentEmailsForCourseType(courseType) {
  // Try scoped lookup: courses → groups → group_members → profiles
  const { data: courses } = await supabaseAdmin
    .from('courses').select('id').ilike('code', `%${courseType}%`);
  const courseIds = (courses || []).map((c) => c.id);

  if (courseIds.length > 0) {
    const { data: groups } = await supabaseAdmin
      .from('groups').select('id').in('course_id', courseIds);
    const groupIds = (groups || []).map((g) => g.id);

    if (groupIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('group_members').select('student_id').in('group_id', groupIds);
      const studentIds = (members || []).map((m) => m.student_id);

      if (studentIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles').select('email').in('id', studentIds);
        const emails = (profiles || []).map((p) => p.email).filter(Boolean);
        if (emails.length > 0) return emails;
      }
    }
  }

  // Fallback: query all students by role (mirrors announcements controller pattern)
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('email').eq('role', 'student');
  return (profiles || []).map((p) => p.email).filter(Boolean);
}

module.exports = { getWeekStatuses, openWeek, closeWeek, lockWeek, setDeadline };
