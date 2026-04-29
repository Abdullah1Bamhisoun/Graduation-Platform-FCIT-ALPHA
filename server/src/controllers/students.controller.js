const { supabaseAdmin } = require('../config/supabase');
const { normalizeCourseCode } = require('../utils/helpers');
const { cacheGet, cacheSet, cacheDel, TTL } = require('../utils/cache');

const myGradesCk = (studentId) => `students:my-grades:${studentId}`;

/**
 * GET /api/students/my-grades
 *
 * Student-only. Returns all grade data for the logged-in student's own group.
 *
 * Security model:
 *   1. The student's group is resolved server-side via:
 *        SELECT group_id FROM group_members WHERE student_id = req.user.id
 *      A student can NEVER supply their own group ID — it is always derived
 *      from their identity. Cross-group access is architecturally impossible.
 *   2. requireRole(['student', 'admin']) is enforced in the router before this
 *      function is called.
 *   3. All returned data is read-only for students. Grade mutations go through
 *      separate role-specific endpoints (supervisor, coordinator, committee).
 *
 * Grading scheme:
 *   Component weights are fetched dynamically from grading_components.
 *   They are NEVER hardcoded here — the Coordinator retains exclusive control
 *   via GradeSchemeEditor, which is the single source of truth for all weights.
 *
 * Peer evaluation:
 *   This endpoint returns the RECEIVED peer rating (read-only).
 *   Submission of peer evaluations goes through a separate endpoint.
 */
async function getMyGrades(req, res) {
  try {
    const studentId = req.user.id;
    const ck = myGradesCk(studentId);
    const cached = await cacheGet(ck);
    if (cached) return res.json(cached);

    // ── Step 1: Resolve student's group (backend-enforced) ──────────────────
    // This is the key access-control step: the group is derived from the
    // student's identity, never from a client-supplied parameter.
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .maybeSingle();

    if (!membership) {
      return res.json(null); // Student not yet assigned to a group
    }

    const groupId = membership.group_id;

    // ── Step 2: Group details (with project_status graceful fallback) ────────
    let group;
    {
      const { data, error } = await supabaseAdmin
        .from('groups')
        .select(`
          id, group_number, project_name, status, course_id,
          project_status, ip_marked_at, ip_reason,
          supervisor:profiles!supervisor_id(id, name),
          course:courses!course_id(id, code, name),
          members:group_members(student_id, student:profiles!student_id(id, name))
        `)
        .eq('id', groupId)
        .single();

      if (error) {
        // Graceful fallback if migration 003 (project_status columns) not yet applied
        if (error.message?.includes('project_status')) {
          console.warn('project_status column missing — run migration 003. Falling back.');
          const { data: fallback, error: fbErr } = await supabaseAdmin
            .from('groups')
            .select(`
              id, group_number, project_name, status, course_id,
              supervisor:profiles!supervisor_id(id, name),
              course:courses!course_id(id, code, name),
              members:group_members(student_id, student:profiles!student_id(id, name))
            `)
            .eq('id', groupId)
            .single();

          if (fbErr) throw fbErr;
          group = { ...fallback, project_status: 'normal', ip_marked_at: null, ip_reason: null };
        } else {
          throw error;
        }
      } else {
        group = data;
      }
    }

    const courseCode = normalizeCourseCode(group.course?.code ?? '');
    const courseType = courseCode.includes('499') ? '499' : '498';
    const courseId   = group.course_id;

    const students = (group.members || []).map((m) => ({
      id:   m.student?.id   ?? m.student_id,
      name: m.student?.name ?? '',
    }));

    // ── Steps 3–11: Run all independent queries in ONE parallel batch ───────
    // Every query below depends only on { groupId, studentId, courseType },
    // which are known after Step 2 — so they can run concurrently.
    const [
      { data: components },
      { data: supRow },
      { data: supRubricRows },
      { data: commRows },
      { data: commRubricRows },
      { data: delivScores },
      { data: acRow },
      { data: coordAssessRows },
      { data: submissions },
      { data: weeklyReports },
      { data: peerReceived },
      { data: peerSubmitted },
    ] = await Promise.all([
      // Step 3: grading components (Coordinator-defined, read-only)
      supabaseAdmin
        .from('grading_components')
        .select('component_key, component_name, total_marks, evaluator_role, display_order')
        .eq('is_active', true)
        .eq('course_type', courseType)
        .order('display_order'),
      // Step 4a: supervisor assessment for THIS student
      supabaseAdmin
        .from('supervisor_assessments')
        .select('score, max_score, graded_at, comment')
        .eq('student_id', studentId)
        .eq('group_id', groupId)
        .maybeSingle(),
      // Step 4b: per-criterion supervisor rubric scores
      supabaseAdmin
        .from('supervisor_rubric_scores')
        .select('criterion_key, raw_score')
        .eq('student_id', studentId)
        .eq('group_id', groupId),
      // Step 5a: committee evaluations
      supabaseAdmin
        .from('committee_evaluations')
        .select('score, max_score, comment, evaluator_id, comment_file_url, comment_file_name')
        .eq('group_id', groupId)
        .in('submission_status', ['submitted', 'locked']),
      // Step 5b: per-criterion committee rubric scores
      supabaseAdmin
        .from('committee_rubric_scores')
        .select('criterion_key, score')
        .eq('group_id', groupId)
        .in('submission_status', ['submitted', 'locked']),
      // Step 6: coordinator deliverable scores
      supabaseAdmin
        .from('coordinator_deliverable_scores')
        .select('deliverable_key, score, max_score, graded_at')
        .eq('group_id', groupId),
      // Step 7: admin committee scores (CPIS-499 only — return null for 498)
      courseType === '499'
        ? supabaseAdmin
            .from('admin_committee_scores')
            .select('poster_day_score, implementation_score, testing_score')
            .eq('group_id', groupId)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      // Step 8: coordinator rubric-based assessment
      supabaseAdmin
        .from('coordinator_assessments')
        .select('normalized_score, max_score, submission_status, comment')
        .eq('group_id', groupId)
        .eq('course_type', courseType)
        .limit(1),
      // Step 8b: chapter submission statuses
      supabaseAdmin
        .from('submissions')
        .select('status')
        .eq('group_id', groupId),
      // Step 9: weekly reports
      supabaseAdmin
        .from('weekly_reports')
        .select('week_number, student_mark, supervisor_mark')
        .eq('group_id', groupId)
        .order('week_number'),
      // Step 10: peer evaluations received by THIS student
      supabaseAdmin
        .from('peer_evaluations')
        .select('score')
        .eq('student_id', studentId)
        .eq('group_id', groupId),
      // Step 11: has THIS student submitted any peer evaluations
      supabaseAdmin
        .from('peer_evaluations')
        .select('id')
        .eq('evaluator_id', studentId)
        .eq('group_id', groupId)
        .limit(1),
    ]);

    // ── Post-processing (pure in-memory, no I/O) ────────────────────────────
    const supervisorMaxScore = courseType === '499' ? 23 : 20;
    const supervisorEval = supRow
      ? {
          score:            supRow.score != null ? Number(supRow.score) : null,
          maxScore:         Number(supRow.max_score ?? supervisorMaxScore),
          gradedAt:         supRow.graded_at ?? null,
          submissionStatus: 'submitted', // no column — if a row exists it was submitted
          comment:          supRow.comment ?? null,
        }
      : null;

    const supervisorCriterionScores = {};
    for (const r of supRubricRows ?? []) {
      supervisorCriterionScores[r.criterion_key] = Number(r.raw_score);
    }

    const commCritSums = {};
    for (const r of commRubricRows ?? []) {
      (commCritSums[r.criterion_key] ??= []).push(Number(r.score));
    }
    const committeeCriterionScores = {};
    for (const [key, vals] of Object.entries(commCritSums)) {
      committeeCriterionScores[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    const committeeScore = commRows && commRows.length > 0
      ? commRows.reduce((s, r) => s + Number(r.score ?? 0), 0) / commRows.length
      : null;

    const committeeComments = (commRows ?? [])
      .map((r) => r.comment)
      .filter((c) => c && c.trim().length > 0);
    const committeeComment = committeeComments.length > 0
      ? committeeComments.join('\n\n---\n\n')
      : null;

    const committeeFileRow = (commRows ?? []).find(
      (r) => r.comment_file_url && r.comment_file_name
    );
    const committeeFileUrl  = committeeFileRow?.comment_file_url  ?? null;
    const committeeFileName = committeeFileRow?.comment_file_name ?? null;

    const deliverablesTotal = (delivScores || []).reduce(
      (s, d) => s + Number(d.score ?? 0), 0
    );

    const deliverableDetail = {};
    for (const d of (delivScores || [])) {
      deliverableDetail[d.deliverable_key] = {
        score:    d.score != null ? Number(d.score) : null,
        maxScore: Number(d.max_score ?? 0),
        gradedAt: d.graded_at ?? null,
      };
    }

    let adminCommitteeTotal = null;
    if (courseType === '499' && acRow) {
      adminCommitteeTotal =
        (Number(acRow.poster_day_score)     ?? 0) +
        (Number(acRow.implementation_score) ?? 0) +
        (Number(acRow.testing_score)        ?? 0);
    }

    const coordinatorScore = coordAssessRows?.[0]?.normalized_score != null
      ? Number(coordAssessRows[0].normalized_score)
      : null;
    const coordinatorComment = coordAssessRows?.[0]?.submission_status !== 'draft'
      ? (coordAssessRows?.[0]?.comment ?? null)
      : null;

    const approvalCounts = {
      total:    (submissions || []).length,
      pending:  (submissions || []).filter((s) => ['submitted', 'under-review'].includes(s.status)).length,
      approved: (submissions || []).filter((s) => s.status === 'approved').length,
      rejected: (submissions || []).filter((s) => s.status === 'changes-requested').length,
    };

    const weeklyRaw = (weeklyReports || []).reduce(
      (s, r) => s + (r.student_mark ?? 0) + (r.supervisor_mark ?? 0), 0
    );
    const weeklyMaxScore = courseType === '499' ? 22 : 20;
    const weeklyScore    = Math.min(weeklyRaw, weeklyMaxScore);
    const weeklyIsAtCap  = weeklyRaw >= weeklyMaxScore;
    const weeksOpened    = (weeklyReports || []).length;

    const weeklyBreakdown = (weeklyReports || []).map((r) => ({
      weekNumber:     r.week_number,
      studentMark:    r.student_mark   ?? 0,
      supervisorMark: r.supervisor_mark ?? 0,
    }));

    const peerScores    = (peerReceived || []).map((p) => Number(p.score));
    const peerAvgRaw    = peerScores.length > 0
      ? peerScores.reduce((s, v) => s + v, 0) / peerScores.length
      : null;
    const peerComponent = (components || []).find((c) => c.component_key === 'peer_review');
    const peerWeight    = peerComponent ? Number(peerComponent.total_marks) : 5;
    const peerConverted = peerAvgRaw != null ? (peerAvgRaw / 5) * peerWeight : null;

    const hasSubmittedPeer = (peerSubmitted || []).length > 0;

    // ── Step 12: Assemble components with scores ───────────────────────────────
    // Scores are mapped from the appropriate source for each component type.
    // The component names, weights, and order come entirely from grading_components.
    const assembledComponents = (components || []).map((c) => {
      let score = null;
      switch (c.component_key) {
        case 'supervisor_eval':
          score = supervisorEval?.score ?? null;
          break;
        case 'committee_eval':
          score = committeeScore;
          break;
        case 'coordinator_eval':
          // Rubric-based coordinator assessment (stored in coordinator_assessments)
          score = coordinatorScore;
          break;
        case 'coordinator_deliverables':
          // Always sum coordinator_deliverable_scores so the header total matches
          // the individual sub-item rows shown in the UI.
          // Fall back to admin_committee_scores for legacy CPIS-499 data.
          score = courseType === '499'
            ? (deliverablesTotal || adminCommitteeTotal)
            : deliverablesTotal;
          break;
        case 'progress_reports':
          score = weeklyScore; // capped at weeklyMaxScore
          break;
        case 'peer_review':
          score = peerConverted; // converted from 1–5 stars to marks
          break;
      }
      return {
        componentKey:  c.component_key,
        componentName: c.component_name,
        totalMarks:    Number(c.total_marks),
        evaluatorRole: c.evaluator_role,
        score,
        maxScore:      Number(c.total_marks),
      };
    });

    // ── Step 13: Total score + letter grade ────────────────────────────────────
    const totalScore = assembledComponents.reduce(
      (s, c) => s + (c.score ?? 0), 0
    );

    const finalGradeLetterOf = (score) =>
      score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'B+'
      : score >= 80 ? 'B' : score >= 75 ? 'C+' : score >= 70 ? 'C'
      : score >= 65 ? 'D+' : score >= 60 ? 'D' : score > 0 ? 'F' : 'In Progress';

    // ── Step 14: Previous course (CPIS-498) committee feedback ────────────────
    // For CPIS-499 students: find their CPIS-498 group and pull committee comments.
    let prevCourseComments = null;
    if (courseType === '499') {
      const { data: allMemberships } = await supabaseAdmin
        .from('group_members')
        .select('group_id')
        .eq('student_id', studentId);

      const allGroupIds = (allMemberships || []).map((m) => m.group_id).filter((id) => id !== groupId);

      if (allGroupIds.length > 0) {
        const { data: prevGroups } = await supabaseAdmin
          .from('groups')
          .select('id, course:courses!course_id(code)')
          .in('id', allGroupIds);

        const prev498GroupIds = (prevGroups || [])
          .filter((g) => g.course?.code?.includes('498'))
          .map((g) => g.id);

        if (prev498GroupIds.length > 0) {
          const { data: prevCommRows } = await supabaseAdmin
            .from('committee_evaluations')
            .select('comment, evaluated_at, evaluator:profiles!evaluator_id(name)')
            .in('group_id', prev498GroupIds)
            .in('submission_status', ['submitted', 'locked'])
            .not('comment', 'is', null)
            .neq('comment', '');

          prevCourseComments = (prevCommRows || [])
            .filter((r) => r.comment && r.comment.trim())
            .map((r) => ({
              comment:       r.comment,
              evaluatorName: r.evaluator?.name ?? 'Committee Member',
              evaluatedAt:   r.evaluated_at ?? null,
            }));
        }
      }
    }

    const payload = {
      groupId:       group.id,
      groupNumber:   group.group_number,
      projectName:   group.project_name,
      status:        group.status,
      projectStatus: group.project_status ?? 'normal',
      ipMarkedAt:    group.ip_marked_at   ?? null,
      ipReason:      group.ip_reason      ?? null,
      courseCode,
      courseType,
      supervisorName: group.supervisor?.name ?? null,
      students,
      components: assembledComponents,
      supervisorEvaluation: supervisorEval,
      committeeEvaluation: committeeScore != null
        ? {
            score:           committeeScore,
            maxScore:        40,
            comment:         committeeComment,
            commentFileUrl:  committeeFileUrl,
            commentFileName: committeeFileName,
          }
        : null,
      coordinatorComment,
      approvalCounts,
      weeklyScore,
      weeklyMaxScore,
      weeklyTotalRaw: weeklyRaw,
      weeksOpened,
      weeklyIsAtCap,
      weeklyBreakdown,
      peerEvaluation: {
        receivedCount:   peerScores.length,
        averageRaw:      peerAvgRaw,
        convertedScore:  peerConverted,
        componentWeight: peerWeight,
        hasSubmitted:    hasSubmittedPeer,
      },
      deliverables:              deliverableDetail,
      deliverablesTotal,
      supervisorCriterionScores,
      committeeCriterionScores,
      totalScore,
      finalGrade: finalGradeLetterOf(totalScore),
      prevCourseComments,
    };
    await cacheSet(ck, payload, TTL.SHORT);
    res.json(payload);
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ error: 'Failed to fetch grades' });
  }
}

/**
 * POST /api/students/peer-evaluations
 *
 * Student submits peer ratings for their teammates.
 * Body: { ratings: { [studentId]: number (1–5) } }
 *
 * Security:
 *   - evaluator_id is always req.user.id (never client-supplied)
 *   - group_id is resolved server-side from the evaluator's membership
 *   - Only teammates in the same group may be rated (cross-group is rejected)
 */
async function submitPeerEvaluations(req, res) {
  try {
    const evaluatorId = req.user.id;
    const { ratings } = req.body;

    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) {
      return res.status(400).json({ error: 'ratings must be an object mapping studentId → score' });
    }

    // Resolve evaluator's group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('student_id', evaluatorId)
      .maybeSingle();

    if (!membership) {
      return res.status(400).json({ error: 'You are not assigned to a group' });
    }

    const groupId = membership.group_id;

    // Fetch group to get course_id and member list
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('course_id, members:group_members(student_id)')
      .eq('id', groupId)
      .single();

    if (!group) {
      return res.status(400).json({ error: 'Group not found' });
    }

    const courseId  = group.course_id;
    const memberIds = (group.members || []).map((m) => m.student_id);

    // Validate: all rated students must be actual teammates (not self)
    for (const studentId of Object.keys(ratings)) {
      if (studentId === evaluatorId) {
        return res.status(400).json({ error: 'You cannot rate yourself' });
      }
      if (!memberIds.includes(studentId)) {
        return res.status(400).json({ error: `Student ${studentId} is not in your group` });
      }
      const score = Number(ratings[studentId]);
      if (!Number.isInteger(score) || score < 1 || score > 5) {
        return res.status(400).json({ error: 'Scores must be integers between 1 and 5' });
      }
    }

    // Upsert one row per rated teammate
    const rows = Object.entries(ratings).map(([studentId, score]) => ({
      student_id:   studentId,
      evaluator_id: evaluatorId,
      group_id:     groupId,
      course_id:    courseId,
      score:        Number(score),
      max_score:    5,
      comment:      null,
    }));

    const { error } = await supabaseAdmin
      .from('peer_evaluations')
      .upsert(rows, { onConflict: 'student_id,evaluator_id,group_id,course_id' });

    if (error) throw error;

    // Peer scores affect each rated student's grade — bust their caches
    await Promise.all(
      Object.keys(req.body.ratings || {}).map((sid) => cacheDel(myGradesCk(sid)))
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting peer evaluations:', error);
    res.status(500).json({ error: 'Failed to submit peer evaluations' });
  }
}

module.exports = { getMyGrades, submitPeerEvaluations };
