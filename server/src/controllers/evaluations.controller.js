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
  const evaluationActive =
    scheduledAt !== null && new Date(scheduledAt) <= new Date();

  return {
    id: g.id,
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
  'id, group_number, project_name, course_number, course_id, course:courses!course_id(code)';

async function getGroupsForEvaluation(req, res) {
  try {
    const supervisorId = req.user.id;

    // ── Step 1: find groups this supervisor supervises — always excluded ────
    const { data: supervisedRows, error: supError } = await supabaseAdmin
      .from('groups')
      .select('id')
      .eq('supervisor_id', supervisorId);

    if (supError) throw supError;

    const supervisedGroupIds = (supervisedRows || []).map((g) => g.id);

    // ── Step 2: check if evaluation_assignments is active ─────────────────
    // Only PostgreSQL error 42P01 ("relation does not exist") means the table
    // is not yet created. Any other error (auth, network, RLS) is a real failure
    // and must NOT silently fall back to showing all groups.
    const { data: assignmentRows, error: assignError } = await supabaseAdmin
      .from('evaluation_assignments')
      .select('group_id')
      .eq('evaluator_id', supervisorId);

    const tableNotFound =
      assignError &&
      (assignError.code === '42P01' ||
        (assignError.message || '').toLowerCase().includes('does not exist'));

    if (assignError && !tableNotFound) {
      // Real error (not "table missing") — fail hard to avoid data leakage
      throw assignError;
    }

    if (!tableNotFound) {
      // ── Assignment-based mode is active ───────────────────────────────────
      const assignedGroupIds = (assignmentRows || [])
        .map((a) => a.group_id)
        .filter((id) => !supervisedGroupIds.includes(id));

      if (assignedGroupIds.length === 0) {
        return res.json({ groups: [], assignmentMode: true });
      }

      const { data: assignedGroups, error: agError } = await supabaseAdmin
        .from('groups')
        .select(GROUP_SELECT)
        .in('id', assignedGroupIds)
        .order('group_number', { ascending: true });

      if (agError) throw agError;

      // ── Fetch presentation schedules for evaluation lock check ─────────────
      const scheduleMap = await fetchScheduleMap(assignedGroupIds);

      return res.json({
        groups: (assignedGroups || []).map((g) => mapGroup(g, scheduleMap)),
        assignmentMode: true,
      });
    }

    // ── Step 3: open mode — no assignment table yet ────────────────────────
    let query = supabaseAdmin
      .from('groups')
      .select(GROUP_SELECT)
      .order('group_number', { ascending: true });

    for (const id of supervisedGroupIds) {
      query = query.neq('id', id);
    }

    const { data: groups, error: gError } = await query;
    if (gError) throw gError;

    // ── Fetch presentation schedules for evaluation lock check ─────────────
    const allGroupIds = (groups || []).map((g) => g.id);
    const scheduleMap = await fetchScheduleMap(allGroupIds);

    return res.json({
      groups: (groups || []).map((g) => mapGroup(g, scheduleMap)),
      assignmentMode: false,
    });
  } catch (error) {
    console.error('Error fetching evaluation groups:', error);
    res.status(500).json({ error: 'Failed to fetch evaluation groups' });
  }
}

module.exports = { getGroupsForEvaluation };
