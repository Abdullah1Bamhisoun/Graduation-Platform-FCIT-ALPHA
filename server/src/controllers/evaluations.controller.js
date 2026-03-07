const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/evaluations/groups
 * Supervisor: returns all groups available for committee evaluation,
 * EXCLUDING any group that this supervisor supervises.
 *
 * Rule: A supervisor may not evaluate their own supervised group.
 * If an evaluation_assignments table exists, only officially assigned groups
 * are returned (still excluding the supervisor's own group).
 * Otherwise, all non-supervised groups are returned.
 */
/**
 * Map a group row to the API response shape.
 * scheduleMap: Map<groupId, { scheduled_at: string|null }>
 * Evaluation is active when scheduled_at exists and is in the past (server time).
 * This check is performed on every request — no caching.
 */
function mapGroup(g, scheduleMap) {
  const sched = scheduleMap ? scheduleMap.get(g.id) : null;
  const scheduledAt = sched?.scheduled_at ?? null;
  // Evaluation unlocks only after the presentation time has passed (server time).
  const evaluationActive = scheduledAt !== null && new Date(scheduledAt) <= new Date();

  return {
    id: g.id,
    groupCode: g.group_code ?? null,
    groupNumber: g.group_number,
    projectName: g.project_name,
    courseNumber: g.course_number,
    courseCode: g.course?.code ?? '',
    scheduledAt,
    evaluationActive,
  };
}

/**
 * Fetch presentation scheduled_at for a list of group IDs.
 * Returns a Map<groupId, { scheduled_at }>. Gracefully handles the case
 * where the scheduled_at column has not yet been migrated (returns empty map).
 */
async function fetchScheduleMap(groupIds) {
  if (!groupIds || groupIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('presentation_schedules')
    .select('group_id, scheduled_at')
    .in('group_id', groupIds);

  if (error) {
    // Missing column → migration pending; treat as no schedules
    const isMissing =
      error.code === '42703' ||
      (error.message || '').toLowerCase().includes('does not exist');
    if (isMissing) return new Map();
    throw error;
  }

  return new Map((data || []).map((s) => [s.group_id, { scheduled_at: s.scheduled_at }]));
}

const GROUP_SELECT =
  'id, group_code, group_number, project_name, course_number, course_id, course:courses!course_id(code)';

async function getGroupsForEvaluation(req, res) {
  try {
    const supervisorId = req.user.id;
    const supervisorName = req.user.name ?? '';

    // ── Step 1: find groups this supervisor supervises — always excluded ────
    const { data: supervisedRows, error: supError } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('supervisor_id', supervisorId);

    if (supError) throw supError;

    const supervisedGroupIds = (supervisedRows || []).map((g) => g.id);

    // ── Step 2: fetch all presentation schedules and filter in JavaScript ────
    // Using JS-side filtering (.includes) instead of PostgREST's array
    // containment operator (.contains / @>) to avoid silent failures caused
    // by type-coercion differences between JSON arrays and PostgreSQL TEXT[].
    let assignedGroupIds = [];
    let scheduleMap = new Map();

    if (supervisorName) {
      const { data: allSchedules, error: schedErr } = await supabaseAdmin
        .from('presentation_schedules')
        .select('group_id, committee_members, scheduled_at');

      if (schedErr) {
        const isMissing =
          schedErr.code === '42P01' ||
          schedErr.code === '42703' ||
          (schedErr.message || '').toLowerCase().includes('does not exist');
        if (isMissing) return res.json({ groups: [], assignmentMode: true });
        throw schedErr;
      }

      // Build schedule map (reuses the fetched rows — avoids a second DB query)
      for (const s of (allSchedules || [])) {
        scheduleMap.set(s.group_id, { scheduled_at: s.scheduled_at });
      }

      // Filter groups where this supervisor is listed as a committee member
      assignedGroupIds = (allSchedules || [])
        .filter(s => Array.isArray(s.committee_members) && s.committee_members.includes(supervisorName))
        .map(s => s.group_id)
        .filter(id => !supervisedGroupIds.includes(id));
    }

    if (assignedGroupIds.length === 0) {
      return res.json({ groups: [], assignmentMode: true });
    }

    const { data: assignedGroups, error: agError } = await supabaseAdmin
      .from('groups')
      .select(GROUP_SELECT)
      .in('id', assignedGroupIds)
      .order('group_number', { ascending: true });

    if (agError) throw agError;

    // scheduleMap was already built above from the fetched schedules data

    return res.json({
      groups: (assignedGroups || []).map((g) => mapGroup(g, scheduleMap)),
      assignmentMode: true,
    });
  } catch (error) {
    console.error('Error fetching evaluation groups:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation groups' });
  }
}

module.exports = { getGroupsForEvaluation };
