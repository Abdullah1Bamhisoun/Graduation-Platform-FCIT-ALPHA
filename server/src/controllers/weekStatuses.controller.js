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
    const msg = err?.message || err?.details || JSON.stringify(err) || 'Failed to fetch week statuses';
    res.status(500).json({ error: msg });
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

    console.log('[weekStatuses] week opened id:', id, '— starting email pipeline');

    // Fetch data needed for email before responding
    const { data: weekRow } = await supabaseAdmin
      .from('week_statuses').select('week_number, course_type').eq('id', id).single();

    res.json({ success: true });

    if (!weekRow) { console.warn('[weekStatuses] weekRow not found for id:', id); return; }

    // Send email to students in this course type (best-effort, non-blocking)
    ;(async () => {
      try {
        const { data: courses } = await supabaseAdmin
          .from('courses').select('id').ilike('code', `%${weekRow.course_type}%`);
        const courseIds = (courses || []).map((c) => c.id);
        console.log('[weekStatuses] courseIds:', courseIds);
        if (courseIds.length === 0) return;

        const { data: groups } = await supabaseAdmin
          .from('groups').select('id').in('course_id', courseIds);
        const groupIds = (groups || []).map((g) => g.id);
        console.log('[weekStatuses] groupIds:', groupIds);
        if (groupIds.length === 0) return;

        const { data: members } = await supabaseAdmin
          .from('group_members').select('student_id').in('group_id', groupIds);
        const studentIds = (members || []).map((m) => m.student_id);
        console.log('[weekStatuses] studentIds:', studentIds);
        if (studentIds.length === 0) return;

        const { data: profiles } = await supabaseAdmin
          .from('profiles').select('email').in('id', studentIds);
        const emails = (profiles || []).map((p) => p.email).filter(Boolean);
        console.log('[weekStatuses] emails:', emails);
        if (emails.length === 0) return;

        await emailService.sendWeekOpened(emails, {
          weekNumber: weekRow.week_number,
          courseType: weekRow.course_type,
        });
        console.log('[weekStatuses] sendWeekOpened done for week', weekRow.week_number);
      } catch (e) {
        console.error('[weekStatuses] Failed to send week-opened emails:', e);
      }
    })();
  } catch (err) {
    console.error('Error opening week:', err);
    res.status(500).json({ error: err.message || 'Failed to open week' });
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
    res.status(500).json({ error: err.message || 'Failed to close week' });
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
    res.status(500).json({ error: err.message || 'Failed to lock week' });
  }
}

module.exports = { getWeekStatuses, openWeek, closeWeek, lockWeek };
