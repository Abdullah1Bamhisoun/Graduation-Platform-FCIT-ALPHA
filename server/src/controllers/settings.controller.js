const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDel, TTL } = require('../utils/cache');

const TERM_NAMES = ['First Semester', 'Second Semester'];
const TERM_CODES = ['01', '02'];
const TERM_CACHE_KEY = 'settings:current-term';

const WEEK_CONFIG_CACHE_KEY = 'settings:week-config';
const DEFAULT_WEEK_CONFIG = { currentWeek: 1, weekOneStartDate: null, holidayWeeks: [] };

/**
 * GET /api/settings/current-term  (public)
 * Returns { term, year, term_code }
 */
async function getCurrentTerm(req, res) {
  try {
    const cached = await cacheGet(TERM_CACHE_KEY);
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from('platform_locks')
      .select('reason, updated_at')
      .eq('entity_type', 'current_term')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    let result;
    if (data && data.reason) {
      try { result = JSON.parse(data.reason); } catch (_) {}
    }
    if (!result) result = { term: 'Second Semester', year: 2026, term_code: '02' };

    await cacheSet(TERM_CACHE_KEY, result, TTL.MEDIUM);
    return res.json(result);
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

    // Invalidate cached term so next GET returns fresh data
    await cacheDel(TERM_CACHE_KEY);

    // ── Auto-migration: CPIS-498 → CPIS-499 when changing TO Second Semester ──
    let migratedGroups = 0;
    if (term_code === '02') {
      migratedGroups = await migrate498To499(req.user.id);
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
async function migrate498To499(actorId) {
  try {
    // Fetch course IDs
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, code')
      .in('code', ['CPIS-498', 'CPIS-499']);

    const cpis498 = (courses || []).find((c) => c.code === 'CPIS-498');
    const cpis499 = (courses || []).find((c) => c.code === 'CPIS-499');

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
      // Update group_code: only replace _498_ → _499_; keep the original term segment intact
      const newCode = (group.group_code || '').replace(/_498_/g, '_499_');

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

/**
 * GET /api/settings/week-config  (public)
 * Returns { currentWeek, weekStartDay, holidayWeeks }
 */
async function getWeekConfig(req, res) {
  try {
    const cached = await cacheGet(WEEK_CONFIG_CACHE_KEY);
    if (cached) return res.json(cached);

    const { data, error } = await supabaseAdmin
      .from('platform_locks')
      .select('reason, updated_at')
      .eq('entity_type', 'week_config')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    let result;
    if (data && data.reason) {
      try { result = JSON.parse(data.reason); } catch (_) {}
    }
    if (!result) result = DEFAULT_WEEK_CONFIG;

    await cacheSet(WEEK_CONFIG_CACHE_KEY, result, TTL.MEDIUM);
    return res.json(result);
  } catch (err) {
    console.error('getWeekConfig error:', err);
    res.status(500).json({ error: 'Failed to fetch week config' });
  }
}

/**
 * PUT /api/settings/week-config  (admin only)
 * Body: { currentWeek, weekStartDay, holidayWeeks }
 */
async function setWeekConfig(req, res) {
  try {
    const { currentWeek, weekOneStartDate, holidayWeeks } = req.body;

    const weekNum = Number(currentWeek);
    if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 16) {
      return res.status(400).json({ error: 'currentWeek must be between 1 and 16' });
    }
    if (weekOneStartDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(weekOneStartDate)) {
      return res.status(400).json({ error: 'weekOneStartDate must be a YYYY-MM-DD date or null' });
    }
    if (
      !Array.isArray(holidayWeeks) ||
      !holidayWeeks.every((w) => Number.isInteger(Number(w)) && w >= 1 && w <= 16)
    ) {
      return res.status(400).json({ error: 'holidayWeeks must be an array of integers between 1 and 16' });
    }

    const configJson = JSON.stringify({ currentWeek: weekNum, weekOneStartDate: weekOneStartDate ?? null, holidayWeeks: holidayWeeks.map(Number) });

    await supabaseAdmin.from('platform_locks').delete().eq('entity_type', 'week_config');

    const { error: insertError } = await supabaseAdmin.from('platform_locks').insert({
      entity_type: 'week_config',
      entity_id: null,
      is_locked: false,
      reason: configJson,
      locked_by: req.user.id,
    });

    if (insertError) throw insertError;

    await cacheDel(WEEK_CONFIG_CACHE_KEY);

    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: 'SET_WEEK_CONFIG',
        entity: 'platform_settings',
        context: { currentWeek: weekNum, weekOneStartDate, holidayWeeks },
      });
    } catch (_) {}

    res.json({ success: true, currentWeek: weekNum, weekOneStartDate: weekOneStartDate ?? null, holidayWeeks: holidayWeeks.map(Number) });
  } catch (err) {
    console.error('setWeekConfig error:', err);
    res.status(500).json({ error: 'Failed to update week config' });
  }
}

/**
 * GET /api/settings/migration-preview  (admin only)
 * Returns:
 *   - groups498: CPIS-498 groups with members + grade summaries (will be migrated)
 *   - groups499: CPIS-499 groups with members (previous-term, will remain unchanged)
 *   - totalStudents498 / totalStudents499 counts
 */
async function getMigrationPreview(req, res) {
  try {
    // ── Fetch course IDs (for grade table joins) ───────────────────────────────
    const { data: courses } = await supabaseAdmin
      .from('courses')
      .select('id, code')
      .in('code', ['CPIS-498', 'CPIS-499']);

    const course498 = (courses || []).find((c) => c.code === 'CPIS-498');
    const course499 = (courses || []).find((c) => c.code === 'CPIS-499');

    // ── Query groups directly by course_number (most reliable) ───────────────
    const [groups498Res, groups499Res] = await Promise.all([
      supabaseAdmin
        .from('groups')
        .select('id, group_code, group_number, project_name, department, gender, course_id')
        .eq('course_number', '498'),
      supabaseAdmin
        .from('groups')
        .select('id, group_code, group_number, project_name, department, gender, course_id')
        .eq('course_number', '499'),
    ]);

    const rawGroups498 = groups498Res.data || [];
    const rawGroups499 = groups499Res.data || [];

    // ── Fetch members separately to avoid join issues ─────────────────────────
    const allGroupIds = [...rawGroups498.map((g) => g.id), ...rawGroups499.map((g) => g.id)];
    let memberRows = [];
    if (allGroupIds.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('group_members')
        .select('group_id, student_id')
        .in('group_id', allGroupIds);
      memberRows = members || [];
    }

    // ── Fetch student profiles for all member IDs ─────────────────────────────
    const allStudentIds = [...new Set(memberRows.map((m) => m.student_id))];
    let profileMap = {};
    if (allStudentIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, student_id')
        .in('id', allStudentIds);
      for (const p of profiles || []) profileMap[p.id] = p;
    }

    // ── Build group → students index ──────────────────────────────────────────
    const groupMembersMap = {};
    for (const m of memberRows) {
      if (!groupMembersMap[m.group_id]) groupMembersMap[m.group_id] = [];
      const profile = profileMap[m.student_id];
      if (profile) groupMembersMap[m.group_id].push(profile);
    }

    // Attach members to each group
    for (const g of rawGroups498) g.members = groupMembersMap[g.id] || [];
    for (const g of rawGroups499) g.members = groupMembersMap[g.id] || [];

    // ── Collect all group IDs and student IDs from CPIS-498 ───────────────────
    const groupIds498 = rawGroups498.map((g) => g.id);
    const allStudentIds498 = rawGroups498.flatMap((g) =>
      (g.members || []).map((m) => m.id).filter(Boolean)
    );

    // ── Fetch grade data for CPIS-498 groups in parallel ──────────────────────
    const [supAssessments, committeeEvals, deliverables, weeklyReports, peerEvals] =
      await Promise.all([
        // Supervisor assessments (per student)
        allStudentIds498.length && course498
          ? supabaseAdmin
              .from('supervisor_assessments')
              .select('student_id, score, max_score')
              .in('student_id', allStudentIds498)
              .eq('course_id', course498.id)
          : Promise.resolve({ data: [] }),

        // Committee evaluations (per student — average multiple evaluators)
        allStudentIds498.length && course498
          ? supabaseAdmin
              .from('committee_evaluations')
              .select('student_id, score, max_score')
              .in('student_id', allStudentIds498)
              .eq('course_id', course498.id)
          : Promise.resolve({ data: [] }),

        // Coordinator deliverables (per group — sum all keys)
        groupIds498.length && course498
          ? supabaseAdmin
              .from('group_deliverable_grades')
              .select('group_id, score, max_score')
              .in('group_id', groupIds498)
              .eq('course_id', course498.id)
          : Promise.resolve({ data: [] }),

        // Weekly reports (per group — sum student_mark + supervisor_mark)
        groupIds498.length
          ? supabaseAdmin
              .from('weekly_reports')
              .select('group_id, student_mark, supervisor_mark')
              .in('group_id', groupIds498)
          : Promise.resolve({ data: [] }),

        // Peer evaluations (per student)
        allStudentIds498.length && course498
          ? supabaseAdmin
              .from('peer_evaluations')
              .select('student_id, score, max_score')
              .in('student_id', allStudentIds498)
              .eq('course_id', course498.id)
          : Promise.resolve({ data: [] }),
      ]);

    // ── Index grade data for fast lookup ──────────────────────────────────────
    // supervisor_assessments: student_id → {score, max_score}
    const supMap = {};
    for (const row of supAssessments.data || []) {
      supMap[row.student_id] = { score: row.score ?? null, max: row.max_score ?? 20 };
    }

    // committee_evaluations: student_id → averaged score
    const committeeRaw = {};
    for (const row of committeeEvals.data || []) {
      if (!committeeRaw[row.student_id]) committeeRaw[row.student_id] = { total: 0, count: 0, max: row.max_score ?? 40 };
      if (row.score != null) { committeeRaw[row.student_id].total += row.score; committeeRaw[row.student_id].count++; }
    }
    const committeeMap = {};
    for (const [sid, v] of Object.entries(committeeRaw)) {
      committeeMap[sid] = { score: v.count ? +(v.total / v.count).toFixed(1) : null, max: v.max };
    }

    // deliverables: group_id → {earned, max}
    const delivMap = {};
    for (const row of deliverables.data || []) {
      if (!delivMap[row.group_id]) delivMap[row.group_id] = { earned: 0, max: 0 };
      if (row.score != null) delivMap[row.group_id].earned += row.score;
      if (row.max_score != null) delivMap[row.group_id].max += row.max_score;
    }

    // weekly_reports: group_id → capped sum (max 20 for CPIS-498)
    const weeklyMap = {};
    for (const row of weeklyReports.data || []) {
      if (!weeklyMap[row.group_id]) weeklyMap[row.group_id] = 0;
      weeklyMap[row.group_id] += (row.student_mark ?? 0) + (row.supervisor_mark ?? 0);
    }

    // peer_evaluations: student_id → averaged score
    const peerRaw = {};
    for (const row of peerEvals.data || []) {
      if (!peerRaw[row.student_id]) peerRaw[row.student_id] = { total: 0, count: 0, max: row.max_score ?? 5 };
      if (row.score != null) { peerRaw[row.student_id].total += row.score; peerRaw[row.student_id].count++; }
    }
    const peerMap = {};
    for (const [sid, v] of Object.entries(peerRaw)) {
      peerMap[sid] = { score: v.count ? +(v.total / v.count).toFixed(1) : null, max: v.max };
    }

    // ── Preview group_code transformation ─────────────────────────────────────
    function previewNewCode(code) {
      return (code || '').replace(/_498_/g, '_499_');
    }

    // ── Build CPIS-498 result with grades ─────────────────────────────────────
    const groups498 = rawGroups498.map((g) => {
      const weeklyRaw = weeklyMap[g.id] ?? 0;
      const weeklyCapped = Math.min(weeklyRaw, 20);
      const deliv = delivMap[g.id] ?? { earned: 0, max: 15 };

      const students = (g.members || []).map((s) => {
        if (!s) return null;
        const sup  = supMap[s.id]       ?? { score: null, max: 20 };
        const com  = committeeMap[s.id] ?? { score: null, max: 40 };
        const peer = peerMap[s.id]      ?? { score: null, max: 5 };

        const total = (sup.score ?? 0) + (com.score ?? 0) + weeklyCapped +
          (deliv.earned ?? 0) + (peer.score ?? 0);

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          student_id: s.student_id,
          grades: {
            supervisor:   { score: sup.score,       max: sup.max },
            committee:    { score: com.score,       max: com.max },
            weekly:       { score: weeklyCapped,    max: 20 },
            deliverables: { score: deliv.earned,    max: deliv.max || 15 },
            peer:         { score: peer.score,      max: peer.max },
            total:        +total.toFixed(1),
          },
        };
      }).filter(Boolean);

      return {
        id: g.id,
        group_code: g.group_code,
        new_group_code: previewNewCode(g.group_code),
        group_number: g.group_number,
        project_name: g.project_name,
        department: g.department,
        gender: g.gender,
        students,
      };
    });

    // ── Build CPIS-499 result (previous term, no grade detail needed) ─────────
    const groups499 = rawGroups499.map((g) => ({
      id: g.id,
      group_code: g.group_code,
      group_number: g.group_number,
      project_name: g.project_name,
      department: g.department,
      gender: g.gender,
      students: (g.members || []).filter(Boolean),
    }));

    const totalStudents498 = groups498.reduce((s, g) => s + g.students.length, 0);
    const totalStudents499 = groups499.reduce((s, g) => s + g.students.length, 0);

    res.json({ groups498, totalStudents498, groups499, totalStudents499 });
  } catch (err) {
    console.error('getMigrationPreview error:', err);
    res.status(500).json({ error: 'Failed to fetch migration preview' });
  }
}

module.exports = { getCurrentTerm, setCurrentTerm, getWeekConfig, setWeekConfig, getMigrationPreview };
