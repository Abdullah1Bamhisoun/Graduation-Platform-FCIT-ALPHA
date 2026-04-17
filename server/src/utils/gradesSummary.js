/**
 * Fetches all grade component scores for a single student and assembles
 * the array expected by emailService.sendAllGrades().
 *
 * Uses supabaseAdmin so it bypasses RLS completely.
 *
 * Returns null if the student has no active group membership.
 */
const { supabaseAdmin } = require('../config/supabase');
const { normalizeCourseCode } = require('./helpers');

async function buildStudentGradesSummary(studentId, groupId) {
  // ── Group / course ──────────────────────────────────────────────────────────
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('id, course_id, course:courses!course_id(code)')
    .eq('id', groupId)
    .single();

  if (!group) return null;

  const courseId   = group.course_id;
  const courseCode = normalizeCourseCode(group.course?.code ?? '');
  const courseType = courseCode.includes('499') ? '499' : '498';

  // ── Grading components (coordinator-defined) ────────────────────────────────
  const { data: components } = await supabaseAdmin
    .from('grading_components')
    .select('component_key, component_name, total_marks, display_order')
    .eq('course_type', courseType)
    .eq('is_active', true)
    .order('display_order');

  if (!components || components.length === 0) return null;

  // ── Fetch all score sources in parallel ─────────────────────────────────────
  const [
    { data: supRow },
    { data: commRows },
    { data: delivScores },
    { data: weeklyReports },
    { data: peerReceived },
    { data: coordAssessRows },
  ] = await Promise.all([
    supabaseAdmin
      .from('supervisor_assessments')
      .select('score, max_score')
      .eq('student_id', studentId)
      .eq('group_id', groupId)
      .maybeSingle(),
    supabaseAdmin
      .from('committee_evaluations')
      .select('score, max_score')
      .eq('group_id', groupId)
      .in('submission_status', ['submitted', 'locked']),
    supabaseAdmin
      .from('coordinator_deliverable_scores')
      .select('score')
      .eq('group_id', groupId),
    supabaseAdmin
      .from('weekly_reports')
      .select('student_mark, supervisor_mark')
      .eq('group_id', groupId),
    supabaseAdmin
      .from('peer_evaluations')
      .select('score')
      .eq('student_id', studentId)
      .eq('group_id', groupId),
    supabaseAdmin
      .from('coordinator_assessments')
      .select('normalized_score, max_score')
      .eq('group_id', groupId)
      .eq('course_type', courseType)
      .limit(1),
  ]);

  // ── Compute scores per component ────────────────────────────────────────────
  const supervisorScore = supRow?.score != null ? Number(supRow.score) : null;

  const committeeScore = commRows && commRows.length > 0
    ? Math.round((commRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / commRows.length) * 100) / 100
    : null;

  const deliverablesTotal = (delivScores || []).reduce((s, d) => s + Number(d.score ?? 0), 0) || null;

  const weeklyMaxScore = courseType === '499' ? 22 : 20;
  const weeklyRaw = (weeklyReports || []).reduce(
    (s, r) => s + (r.student_mark ?? 0) + (r.supervisor_mark ?? 0), 0
  );
  const weeklyScore = weeklyRaw > 0 ? Math.min(weeklyRaw, weeklyMaxScore) : null;

  const peerScores = (peerReceived || []).map((p) => Number(p.score));
  const peerComponent = components.find((c) => c.component_key === 'peer_review');
  const peerWeight = peerComponent ? Number(peerComponent.total_marks) : 5;
  const peerScore = peerScores.length > 0
    ? Math.round((peerScores.reduce((a, b) => a + b, 0) / peerScores.length / 5) * peerWeight * 100) / 100
    : null;

  const coordinatorScore = coordAssessRows?.[0]?.normalized_score != null
    ? Number(coordAssessRows[0].normalized_score)
    : null;

  const scoreMap = {
    supervisor_eval:           supervisorScore,
    committee_eval:            committeeScore,
    coordinator_deliverables:  deliverablesTotal,
    progress_reports:          weeklyScore,
    peer_review:               peerScore,
    coordinator_eval:          coordinatorScore,
  };

  // ── Assemble component list ─────────────────────────────────────────────────
  const componentList = components.map((c) => ({
    name:     c.component_name,
    score:    scoreMap[c.component_key] ?? null,
    maxScore: Number(c.total_marks),
  }));

  const totalScore = componentList.reduce((s, c) => s + (c.score ?? 0), 0);
  const totalMax   = componentList.reduce((s, c) => s + c.maxScore, 0);

  return { courseCode, componentList, totalScore: Math.round(totalScore * 100) / 100, totalMax };
}

module.exports = { buildStudentGradesSummary };
