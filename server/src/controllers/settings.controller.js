const { supabaseAdmin } = require('../config/supabase');

const TERM_NAMES = ['First Semester', 'Second Semester', 'Summer'];
const TERM_CODES = ['01', '02', '03'];

/**
 * GET /api/settings/current-term  (public)
 * Returns { term, year, term_code }
 */
async function getCurrentTerm(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('platform_locks')
      .select('reason, updated_at')
      .eq('entity_type', 'current_term')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    if (data && data.reason) {
      try {
        return res.json(JSON.parse(data.reason));
      } catch (_) {}
    }

    // Default fallback
    return res.json({ term: 'Second Semester', year: 2026, term_code: '02' });
  } catch (err) {
    console.error('getCurrentTerm error:', err);
    res.status(500).json({ error: 'Failed to fetch current term' });
  }
}

/**
 * PUT /api/settings/current-term  (admin only)
 * Body: { term, year, term_code }
 * When advancing to Second Semester (term_code='02'), auto-migrates CPIS-498 → CPIS-499.
 */
async function setCurrentTerm(req, res) {
  try {
    const { term, year, term_code } = req.body;

    if (!TERM_NAMES.includes(term)) {
      return res.status(400).json({ error: `Invalid term. Must be one of: ${TERM_NAMES.join(', ')}` });
    }
    if (!TERM_CODES.includes(term_code)) {
      return res.status(400).json({ error: `Invalid term_code. Must be one of: ${TERM_CODES.join(', ')}` });
    }
    if (!Number.isInteger(Number(year)) || year < 2020 || year > 2100) {
      return res.status(400).json({ error: 'Invalid year' });
    }

    const termJson = JSON.stringify({ term, year: Number(year), term_code });

    // Upsert: delete any existing 'current_term' rows then insert fresh
    await supabaseAdmin
      .from('platform_locks')
      .delete()
      .eq('entity_type', 'current_term');

    const { error: insertError } = await supabaseAdmin
      .from('platform_locks')
      .insert({
        entity_type: 'current_term',
        entity_id: null,
        is_locked: false,
        reason: termJson,
        locked_by: req.user.id,
      });

    if (insertError) throw insertError;

    // ── Auto-migration: CPIS-498 → CPIS-499 when changing TO Second Semester ──
    let migratedGroups = 0;
    if (term_code === '02') {
      migratedGroups = await migrate498To499(req.user.id, term_code);
    }

    // Audit log (non-fatal)
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: 'SET_CURRENT_TERM',
        entity: 'platform_settings',
        context: { term, year, term_code, migratedGroups },
      });
    } catch (_) { /* non-fatal */ }

    res.json({ success: true, term, year: Number(year), term_code, migratedGroups });
  } catch (err) {
    console.error('setCurrentTerm error:', err);
    res.status(500).json({ error: 'Failed to update current term' });
  }
}

/**
 * Migrate all CPIS-498 groups → CPIS-499.
 * Updates course_id, course_number, and the course-number segment of group_code.
 * Returns the number of groups migrated.
 */
async function migrate498To499(actorId, newTermCode) {
  try {
    // Fetch course IDs
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, code')
      .in('code', ['CPIS_498', 'CPIS_499']);

    const cpis498 = (courses || []).find((c) => c.code === 'CPIS_498');
    const cpis499 = (courses || []).find((c) => c.code === 'CPIS_499');

    if (!cpis498 || !cpis499) {
      console.warn('migrate498To499: could not find both courses');
      return 0;
    }

    // Fetch all groups in CPIS-498
    const { data: groups498, error: fetchError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code, course_number')
      .eq('course_id', cpis498.id);

    if (fetchError) throw fetchError;
    if (!groups498 || groups498.length === 0) return 0;

    // Update each group
    let count = 0;
    for (const group of groups498) {
      // Update group_code: replace _498_ → _499_ and old term_code portion
      const newCode = (group.group_code || '')
        .replace(/_498_/g, '_499_')
        .replace(/_01_|_03_/g, `_${newTermCode}_`);

      const { error: updateError } = await supabaseAdmin
        .from('groups')
        .update({
          course_id: cpis499.id,
          course_number: '499',
          group_code: newCode,
        })
        .eq('id', group.id);

      if (!updateError) count++;
      else console.warn(`migrate498To499: failed to update group ${group.id}:`, updateError.message);
    }

    return count;
  } catch (err) {
    console.error('migrate498To499 error:', err);
    return 0;
  }
}

module.exports = { getCurrentTerm, setCurrentTerm };
