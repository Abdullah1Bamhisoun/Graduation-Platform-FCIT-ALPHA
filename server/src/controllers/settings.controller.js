const { supabaseAdmin } = require('../config/supabase');
const { cacheGet, cacheSet, cacheDel, TTL } = require('../utils/cache');

const TERM_NAMES = ['First Semester', 'Second Semester'];
const TERM_CODES = ['01', '02'];
const TERM_CACHE_KEY = 'settings:current-term';
const PASS_MARK = 60;

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
    const { term, year, term_code, triggerMigration } = req.body;

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

    // Snapshot current grade scheme before overwriting the term
    try {
      const cached = await cacheGet(TERM_CACHE_KEY);
      let oldTerm = cached;
      if (!oldTerm) {
        const { data: existing } = await supabaseAdmin
          .from('platform_locks').select('reason').eq('entity_type', 'current_term')
          .order('updated_at', { ascending: false }).limit(1).maybeSingle();
        if (existing?.reason) try { oldTerm = JSON.parse(existing.reason); } catch (_) {}
      }
      if (oldTerm?.year && oldTerm?.term_code) {
        await Promise.all([
          saveSchemeSnapshot('498', oldTerm.year, oldTerm.term_code, req.user.id),
          saveSchemeSnapshot('499', oldTerm.year, oldTerm.term_code, req.user.id),
        ]);
      }
    } catch (_) { /* non-fatal */ }

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

    // ── Auto-migration: CPIS-498 → CPIS-499 when explicitly triggered from migration page ──
    let migratedGroups = 0;
    if (triggerMigration === true) {
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
 * Returns a Set of group IDs where every student's total grade >= PASS_MARK.
 * Groups with no students are excluded (nothing to migrate).
 */
async function getPassingGroupIds(groupIds, course498Id) {
  if (!groupIds.length) return new Set();

  const { data: members } = await supabaseAdmin
    .from('group_members').select('group_id, student_id').in('group_id', groupIds);

  const memberRows = members || [];
  const studentIds = [...new Set(memberRows.map((m) => m.student_id))];
  if (!studentIds.length) return new Set();

  const groupStudentsMap = {};
  for (const m of memberRows) {
    if (!groupStudentsMap[m.group_id]) groupStudentsMap[m.group_id] = [];
    groupStudentsMap[m.group_id].push(m.student_id);
  }

  const [supRes, comRes, delivRes, weeklyRes, peerRes] = await Promise.all([
    supabaseAdmin.from('supervisor_assessments').select('student_id, score').in('student_id', studentIds).eq('course_id', course498Id),
    supabaseAdmin.from('committee_evaluations').select('student_id, score').in('student_id', studentIds).eq('course_id', course498Id),
    supabaseAdmin.from('group_deliverable_grades').select('group_id, score').in('group_id', groupIds).eq('course_id', course498Id),
    supabaseAdmin.from('weekly_reports').select('group_id, student_mark, supervisor_mark').in('group_id', groupIds),
    supabaseAdmin.from('peer_evaluations').select('student_id, score').in('student_id', studentIds).eq('course_id', course498Id),
  ]);

  const supMap = {};
  for (const r of supRes.data || []) supMap[r.student_id] = r.score ?? 0;

  const comRaw = {};
  for (const r of comRes.data || []) {
    if (!comRaw[r.student_id]) comRaw[r.student_id] = { sum: 0, n: 0 };
    if (r.score != null) { comRaw[r.student_id].sum += r.score; comRaw[r.student_id].n++; }
  }
  const comMap = {};
  for (const [sid, v] of Object.entries(comRaw)) comMap[sid] = v.n ? v.sum / v.n : 0;

  const delivMap = {};
  for (const r of delivRes.data || []) {
    if (!delivMap[r.group_id]) delivMap[r.group_id] = 0;
    delivMap[r.group_id] += r.score ?? 0;
  }

  const weeklyMap = {};
  for (const r of weeklyRes.data || []) {
    if (!weeklyMap[r.group_id]) weeklyMap[r.group_id] = 0;
    weeklyMap[r.group_id] += (r.student_mark ?? 0) + (r.supervisor_mark ?? 0);
  }

  const peerRaw = {};
  for (const r of peerRes.data || []) {
    if (!peerRaw[r.student_id]) peerRaw[r.student_id] = { sum: 0, n: 0 };
    if (r.score != null) { peerRaw[r.student_id].sum += r.score; peerRaw[r.student_id].n++; }
  }
  const peerMap = {};
  for (const [sid, v] of Object.entries(peerRaw)) peerMap[sid] = v.n ? v.sum / v.n : 0;

  const passingIds = new Set();
  for (const [gid, students] of Object.entries(groupStudentsMap)) {
    if (!students.length) continue;
    const weekly = Math.min(weeklyMap[gid] ?? 0, 20);
    const deliv = delivMap[gid] ?? 0;
    const allPassed = students.every((sid) => {
      const total = (supMap[sid] ?? 0) + (comMap[sid] ?? 0) + weekly + deliv + (peerMap[sid] ?? 0);
      return total >= PASS_MARK;
    });
    if (allPassed) passingIds.add(gid);
  }

  return passingIds;
}

/**
 * Migrate CPIS-498 groups → CPIS-499, but only for groups where all students passed.
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

    // Only migrate groups where all students passed
    const passingIds = await getPassingGroupIds(groups498.map((g) => g.id), cpis498.id);
    const groupsToMigrate = groups498.filter((g) => passingIds.has(g.id));

    if (!groupsToMigrate.length) return 0;

    let count = 0;
    for (const group of groupsToMigrate) {
      const newCode = (group.group_code || '').replace(/_498_/g, '_499_');
      const { error: updateError } = await supabaseAdmin
        .from('groups')
        .update({ course_id: cpis499.id, course_number: '499', group_code: newCode })
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

      const willMigrate = students.length > 0 && students.every((s) => s.grades.total >= PASS_MARK);

      return {
        id: g.id,
        group_code: g.group_code,
        new_group_code: willMigrate ? previewNewCode(g.group_code) : null,
        will_migrate: willMigrate,
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

/**
 * Fetch grade scheme components + criteria for a given courseType.
 * Used for snapshotting and for term-data responses.
 */
async function fetchSchemeForCourseType(courseType) {
  const [compRes, critRes] = await Promise.all([
    supabaseAdmin.from('grading_components').select('*').eq('course_type', courseType).eq('is_active', true).order('display_order'),
    supabaseAdmin.from('grading_rubric_criteria').select('*').eq('course_type', courseType).eq('is_active', true).order('display_order'),
  ]);
  return { components: compRes.data || [], criteria: critRes.data || [] };
}

/**
 * Save a grade scheme snapshot for a specific term + course type in platform_locks.
 * entity_type format: scheme_snapshot_<courseType>_<year>_<term_code>
 */
async function saveSchemeSnapshot(courseType, year, term_code, actorId) {
  try {
    const scheme = await fetchSchemeForCourseType(courseType);
    const entityType = `scheme_snapshot_${courseType}_${year}_${term_code}`;
    // Remove any stale snapshot first
    await supabaseAdmin.from('platform_locks').delete().eq('entity_type', entityType);
    await supabaseAdmin.from('platform_locks').insert({
      entity_type: entityType,
      entity_id: null,
      is_locked: false,
      reason: JSON.stringify(scheme),
      locked_by: actorId,
    });
  } catch (err) {
    console.warn(`saveSchemeSnapshot(${courseType}, ${year}, ${term_code}):`, err.message);
  }
}

/**
 * GET /api/settings/terms-list  (admin only)
 * Returns all distinct terms that have group data, sorted newest first.
 * Also marks which term is currently active.
 */
async function getTermsList(req, res) {
  try {
    // Fetch groups and current term independently so neither can block the other
    const groupsRes = await supabaseAdmin.from('groups').select('group_code');

    let currentTerm = await cacheGet(TERM_CACHE_KEY).catch(() => null);
    if (!currentTerm) {
      const { data } = await supabaseAdmin
        .from('platform_locks').select('reason').eq('entity_type', 'current_term')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data?.reason) try { currentTerm = JSON.parse(data.reason); } catch (_) {}
    }
    if (!currentTerm) currentTerm = { term: 'Second Semester', year: 2026, term_code: '02' };

    const termMap = new Map();
    for (const g of groupsRes.data || []) {
      const parts = (g.group_code || '').split('_');
      if (parts.length < 5) continue;
      const year = parseInt(parts[3]);
      const tc   = parts[4];
      if (isNaN(year) || !TERM_CODES.includes(tc)) continue;
      const key = `${year}_${tc}`;
      if (!termMap.has(key)) {
        termMap.set(key, {
          year,
          term_code: tc,
          term: tc === '01' ? 'First Semester' : 'Second Semester',
        });
      }
    }

    // Ensure current term is always in the list even if no groups yet
    const ck = `${currentTerm.year}_${currentTerm.term_code}`;
    if (!termMap.has(ck)) termMap.set(ck, currentTerm);

    const terms = Array.from(termMap.values())
      .sort((a, b) => b.year - a.year || b.term_code.localeCompare(a.term_code))
      .map((t) => ({
        ...t,
        isCurrent: t.year === currentTerm.year && t.term_code === currentTerm.term_code,
      }));

    res.json({ terms, currentTerm });
  } catch (err) {
    console.error('getTermsList error:', err);
    res.status(500).json({ error: 'Failed to fetch terms list' });
  }
}

/**
 * GET /api/settings/term-data?year=2026&term_code=01  (admin only)
 * Returns all groups, students, and grades for the given term.
 * Also returns the grade scheme snapshot for that term (or current if no snapshot).
 */
async function getTermData(req, res) {
  try {
    const year      = parseInt(req.query.year);
    const term_code = req.query.term_code;

    if (isNaN(year) || !TERM_CODES.includes(term_code)) {
      return res.status(400).json({ error: 'Valid year and term_code (01|02) are required' });
    }

    // ── Fetch groups whose group_code embeds this term ────────────────────────
    const pattern498 = `%_498_${year}_${term_code}_%`;
    const pattern499 = `%_499_${year}_${term_code}_%`;

    const [res498, res499] = await Promise.all([
      supabaseAdmin.from('groups').select('id, group_code, group_number, project_name, department, gender, course_number, course_id').ilike('group_code', pattern498),
      supabaseAdmin.from('groups').select('id, group_code, group_number, project_name, department, gender, course_number, course_id').ilike('group_code', pattern499),
    ]);

    const rawGroups = [...(res498.data || []), ...(res499.data || [])];
    const groupIds  = rawGroups.map((g) => g.id);

    // ── Fetch courses for grade queries ───────────────────────────────────────
    const { data: courses } = await supabaseAdmin.from('courses').select('id, code').in('code', ['CPIS-498', 'CPIS-499']);
    const course498 = (courses || []).find((c) => c.code === 'CPIS-498');
    const course499 = (courses || []).find((c) => c.code === 'CPIS-499');
    const courseIdMap = {};
    if (course498) courseIdMap[course498.id] = '498';
    if (course499) courseIdMap[course499.id] = '499';

    // ── Fetch members ─────────────────────────────────────────────────────────
    let memberRows = [];
    if (groupIds.length) {
      const { data } = await supabaseAdmin.from('group_members').select('group_id, student_id').in('group_id', groupIds);
      memberRows = data || [];
    }
    const studentIds = [...new Set(memberRows.map((m) => m.student_id))];

    // ── Fetch student profiles ────────────────────────────────────────────────
    const profileMap = {};
    if (studentIds.length) {
      const { data } = await supabaseAdmin.from('profiles').select('id, name, email, student_id').in('id', studentIds);
      for (const p of data || []) profileMap[p.id] = p;
    }

    // ── Fetch grade data ──────────────────────────────────────────────────────
    const courseIds = [course498?.id, course499?.id].filter(Boolean);

    const [supRes, comRes, delivRes, weeklyRes, peerRes] = await Promise.all([
      studentIds.length && courseIds.length
        ? supabaseAdmin.from('supervisor_assessments').select('student_id, score, max_score, course_id').in('student_id', studentIds).in('course_id', courseIds)
        : { data: [] },
      studentIds.length && courseIds.length
        ? supabaseAdmin.from('committee_evaluations').select('student_id, score, max_score, course_id').in('student_id', studentIds).in('course_id', courseIds)
        : { data: [] },
      groupIds.length && courseIds.length
        ? supabaseAdmin.from('group_deliverable_grades').select('group_id, score, max_score, course_id').in('group_id', groupIds).in('course_id', courseIds)
        : { data: [] },
      groupIds.length
        ? supabaseAdmin.from('weekly_reports').select('group_id, student_mark, supervisor_mark').in('group_id', groupIds)
        : { data: [] },
      studentIds.length && courseIds.length
        ? supabaseAdmin.from('peer_evaluations').select('student_id, score, max_score, course_id').in('student_id', studentIds).in('course_id', courseIds)
        : { data: [] },
    ]);

    // ── Build grade lookup maps ───────────────────────────────────────────────
    const supMap = {};
    for (const r of supRes.data || []) supMap[r.student_id] = { score: r.score ?? null, max: r.max_score ?? 20 };

    const comRaw = {};
    for (const r of comRes.data || []) {
      if (!comRaw[r.student_id]) comRaw[r.student_id] = { total: 0, count: 0, max: r.max_score ?? 40 };
      if (r.score != null) { comRaw[r.student_id].total += r.score; comRaw[r.student_id].count++; }
    }
    const comMap = {};
    for (const [sid, v] of Object.entries(comRaw)) comMap[sid] = { score: v.count ? +(v.total / v.count).toFixed(1) : null, max: v.max };

    const delivMap = {};
    for (const r of delivRes.data || []) {
      if (!delivMap[r.group_id]) delivMap[r.group_id] = { earned: 0, max: 0 };
      if (r.score != null) delivMap[r.group_id].earned += r.score;
      if (r.max_score != null) delivMap[r.group_id].max += r.max_score;
    }

    const weeklyMap = {};
    for (const r of weeklyRes.data || []) {
      if (!weeklyMap[r.group_id]) weeklyMap[r.group_id] = 0;
      weeklyMap[r.group_id] += (r.student_mark ?? 0) + (r.supervisor_mark ?? 0);
    }

    const peerRaw = {};
    for (const r of peerRes.data || []) {
      if (!peerRaw[r.student_id]) peerRaw[r.student_id] = { total: 0, count: 0, max: r.max_score ?? 5 };
      if (r.score != null) { peerRaw[r.student_id].total += r.score; peerRaw[r.student_id].count++; }
    }
    const peerMap = {};
    for (const [sid, v] of Object.entries(peerRaw)) peerMap[sid] = { score: v.count ? +(v.total / v.count).toFixed(1) : null, max: v.max };

    // ── Build group → students index ──────────────────────────────────────────
    const groupStudentsMap = {};
    for (const m of memberRows) {
      if (!groupStudentsMap[m.group_id]) groupStudentsMap[m.group_id] = [];
      const p = profileMap[m.student_id];
      if (p) groupStudentsMap[m.group_id].push(p);
    }

    // ── Assemble groups with grades ───────────────────────────────────────────
    const groups = rawGroups.map((g) => {
      const weekly  = Math.min(weeklyMap[g.id] ?? 0, 20);
      const deliv   = delivMap[g.id] ?? { earned: 0, max: 15 };
      const students = (groupStudentsMap[g.id] || []).map((s) => {
        const sup  = supMap[s.id]  ?? { score: null, max: 20 };
        const com  = comMap[s.id]  ?? { score: null, max: 40 };
        const peer = peerMap[s.id] ?? { score: null, max: 5 };
        const total = (sup.score ?? 0) + (com.score ?? 0) + weekly + (deliv.earned ?? 0) + (peer.score ?? 0);
        return {
          id: s.id, name: s.name, email: s.email, student_id: s.student_id,
          grades: {
            supervisor:   { score: sup.score,    max: sup.max },
            committee:    { score: com.score,    max: com.max },
            weekly:       { score: weekly,       max: 20 },
            deliverables: { score: deliv.earned, max: deliv.max || 15 },
            peer:         { score: peer.score,   max: peer.max },
            total: +total.toFixed(1),
          },
        };
      });
      return {
        id: g.id, group_code: g.group_code, group_number: g.group_number,
        course_number: g.course_number, project_name: g.project_name,
        department: g.department, gender: g.gender, students,
      };
    }).sort((a, b) => a.course_number.localeCompare(b.course_number) || a.group_number - b.group_number);

    // ── Fetch grade scheme (snapshot or current) ──────────────────────────────
    const loadSnapshot = async (courseType) => {
      const et = `scheme_snapshot_${courseType}_${year}_${term_code}`;
      const { data } = await supabaseAdmin.from('platform_locks').select('reason').eq('entity_type', et).maybeSingle();
      if (data?.reason) try { return { ...JSON.parse(data.reason), isSnapshot: true }; } catch (_) {}
      return null;
    };

    const [snap498, snap499, live498, live499] = await Promise.all([
      loadSnapshot('498'), loadSnapshot('499'),
      fetchSchemeForCourseType('498'), fetchSchemeForCourseType('499'),
    ]);

    const scheme = {
      '498': snap498 ?? { ...live498, isSnapshot: false },
      '499': snap499 ?? { ...live499, isSnapshot: false },
    };

    res.json({
      year, term_code, term: term_code === '01' ? 'First Semester' : 'Second Semester',
      groups, scheme,
    });
  } catch (err) {
    console.error('getTermData error:', err);
    res.status(500).json({ error: 'Failed to fetch term data' });
  }
}

module.exports = { getCurrentTerm, setCurrentTerm, getWeekConfig, setWeekConfig, getMigrationPreview, getTermsList, getTermData };
