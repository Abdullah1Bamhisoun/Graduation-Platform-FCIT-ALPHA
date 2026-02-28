const { supabaseAdmin } = require('../config/supabase');

/**
 * GET /api/submissions/chapter-submissions
 *
 * Supervisor-only endpoint.
 * Returns all submissions for groups supervised by the requesting user.
 * The supervisor_id filter is enforced here at the backend — supervisors
 * cannot see submissions belonging to groups assigned to other supervisors.
 */
async function getChapterSubmissionsForSupervisor(req, res) {
  try {
    const supervisorId = req.user.id;

    // Step 1 — get groups assigned to this supervisor (backend-enforced filter)
    const { data: groups, error: gError } = await supabaseAdmin
      .from('groups')
      .select('id, group_number, project_name')
      .eq('supervisor_id', supervisorId);

    if (gError) throw gError;
    if (!groups || groups.length === 0) return res.json([]);

    const groupIds = groups.map((g) => g.id);
    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

    // Step 2 — get submissions for those groups
    const { data: submissions, error: sError } = await supabaseAdmin
      .from('submissions')
      .select(`
        id, group_id, student_id, milestone_id, status,
        current_version, created_at, updated_at,
        milestone:milestones!milestone_id(id, name, type, due_date),
        student:profiles!student_id(id, name),
        versions:submission_versions(version, file_name, file_size, uploaded_at, notes),
        feedback:submission_feedback(id, overall_comment, reviewed_by, reviewed_at)
      `)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false });

    if (sError) throw sError;

    const result = (submissions || []).map((s) => ({
      id: s.id,
      groupId: s.group_id,
      groupNumber: groupMap[s.group_id]?.group_number ?? null,
      projectName: groupMap[s.group_id]?.project_name ?? '',
      studentId: s.student_id,
      studentName: s.student?.name ?? '',
      milestoneId: s.milestone_id,
      milestoneName: s.milestone?.name ?? '',
      milestoneType: s.milestone?.type ?? '',
      dueDate: s.milestone?.due_date ?? null,
      status: s.status,
      currentVersion: s.current_version,
      submittedAt: s.updated_at ?? s.created_at,
      versions: (s.versions || []).sort((a, b) => a.version - b.version),
      hasFeedback: (s.feedback || []).length > 0,
      latestFeedback:
        (s.feedback || []).sort(
          (a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
        )[0] ?? null,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching chapter submissions:', error);
    res.status(500).json({ error: 'Failed to fetch chapter submissions' });
  }
}

/**
 * PATCH /api/submissions/:id/approval
 *
 * Supervisor-only endpoint.
 * Approve or reject a chapter submission.
 * Backend-enforced: the submission must belong to a group assigned to this supervisor.
 * Approval/rejection is stored in submissions.status and submission_feedback — completely
 * separate from any grading tables (supervisor_rubric_scores, coordinator_deliverable_scores, etc.).
 *
 * Body: { action: 'approve' | 'reject', feedback?: string }
 * - For 'reject', feedback is required.
 * - For 'approve', feedback is optional.
 */
async function updateSubmissionApproval(req, res) {
  try {
    const { id: submissionId } = req.params;
    const { action, feedback } = req.body;

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' });
    }

    if (action === 'reject' && (!feedback || !feedback.trim())) {
      return res.status(400).json({ error: 'Feedback is required when rejecting a submission' });
    }

    // Fetch the submission
    const { data: submission, error: sError } = await supabaseAdmin
      .from('submissions')
      .select('id, group_id, status')
      .eq('id', submissionId)
      .single();

    if (sError || !submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify the group is assigned to this supervisor (unless admin)
    if (!req.user.roles.includes('admin')) {
      const { data: group, error: gError } = await supabaseAdmin
        .from('groups')
        .select('supervisor_id')
        .eq('id', submission.group_id)
        .single();

      if (gError || !group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      if (group.supervisor_id !== req.user.id) {
        return res.status(403).json({
          error: 'Access denied: this group is not assigned to you',
        });
      }
    }

    // Determine new status — approval and grading are intentionally separate
    const newStatus = action === 'approve' ? 'approved' : 'changes-requested';

    // Update submission status
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', submissionId);

    if (updateError) throw updateError;

    // Store the review feedback (score fields are 0 — approval is not grading)
    if (feedback || action === 'reject') {
      const { error: fbError } = await supabaseAdmin.from('submission_feedback').insert({
        submission_id: submissionId,
        overall_comment: feedback?.trim() || '',
        reviewed_by: req.user.id,
        reviewed_at: new Date().toISOString(),
        total_score: 0,
        max_score: 0,
      });

      if (fbError) {
        // Non-fatal: status is already updated; log the feedback error
        console.warn('Could not store submission feedback:', fbError.message);
      }
    }

    // Audit log (non-fatal)
    try {
      await supabaseAdmin.from('audit_log').insert({
        actor_id: req.user.id,
        action: `CHAPTER_SUBMISSION_${action === 'approve' ? 'APPROVED' : 'REJECTED'}`,
        entity: 'submission',
        context: { submissionId, groupId: submission.group_id, newStatus },
      });
    } catch {
      /* non-fatal */
    }

    res.json({ success: true, newStatus });
  } catch (error) {
    console.error('Error updating submission approval:', error);
    res.status(500).json({ error: 'Failed to update submission' });
  }
}

/**
 * GET /api/chapters/submissions?courseType=498&filterGroup=all
 *
 * Coordinator-only endpoint.
 * Returns all chapter submissions for groups in the coordinator's assigned course.
 * The course_id filter is enforced here at the backend — coordinators
 * cannot see submissions belonging to groups in other courses.
 */
async function getChapterSubmissionsForCoordinator(req, res) {
  try {
    const { filterGroup, courseType } = req.query;
    const coordinatorId = req.user.id;
    const isAdmin = req.user.activeRole === 'admin';

    // Step 1 — resolve course ID
    let coordinatorCourseId = req.user.coordinatorCourseId;

    if (!coordinatorCourseId) {
      if (isAdmin && courseType && ['498', '499'].includes(courseType)) {
        // Admin: look up course by courseType
        const { data: courseRow } = await supabaseAdmin
          .from('courses')
          .select('id')
          .ilike('code', `%${courseType}%`)
          .limit(1)
          .maybeSingle();
        if (!courseRow) {
          return res.status(404).json({ error: `No course found for courseType ${courseType}` });
        }
        coordinatorCourseId = courseRow.id;
      } else {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
    }

    // Step 2 — get all groups in the assigned course
    let groupQuery = supabaseAdmin
      .from('groups')
      .select('id, group_number, project_name')
      .eq('course_id', coordinatorCourseId);

    // Optional: filter by specific group
    if (filterGroup && filterGroup !== 'all') {
      groupQuery = groupQuery.eq('id', filterGroup);
    }

    const { data: groups, error: gError } = await groupQuery;

    if (gError) throw gError;
    if (!groups || groups.length === 0) return res.json({ submissions: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } });

    const groupIds = groups.map((g) => g.id);
    const groupMap = Object.fromEntries(groups.map((g) => [g.id, g]));

    // Step 3 — get submissions (chapters) for those groups
    const { data: submissions, error: sError } = await supabaseAdmin
      .from('submissions')
      .select(`
        id, group_id, student_id, milestone_id, status,
        current_version, created_at, updated_at,
        milestone:milestones!milestone_id(id, name, type, due_date),
        student:profiles!student_id(id, name),
        versions:submission_versions(version, file_name, file_size, uploaded_at, notes),
        feedback:submission_feedback(id, overall_comment, reviewed_by, reviewed_at)
      `)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false });

    if (sError) throw sError;

    const result = (submissions || []).map((s) => ({
      id: s.id,
      groupId: s.group_id,
      groupNumber: groupMap[s.group_id]?.group_number ?? null,
      projectName: groupMap[s.group_id]?.project_name ?? '',
      studentId: s.student_id,
      studentName: s.student?.name ?? '',
      milestoneId: s.milestone_id,
      milestoneName: s.milestone?.name ?? '',
      milestoneType: s.milestone?.type ?? '',
      dueDate: s.milestone?.due_date ?? null,
      status: s.status,
      currentVersion: s.current_version,
      submittedAt: s.updated_at ?? s.created_at,
      versions: (s.versions || []).sort((a, b) => a.version - b.version),
      hasFeedback: (s.feedback || []).length > 0,
      latestFeedback:
        (s.feedback || []).sort(
          (a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime()
        )[0] ?? null,
    }));

    // Step 4 — calculate statistics
    const stats = {
      total: result.length,
      pending: result.filter((s) => s.status === 'pending' || s.status === 'under-review').length,
      approved: result.filter((s) => s.status === 'approved').length,
      rejected: result.filter((s) => s.status === 'changes-requested').length,
    };

    res.json({ submissions: result, stats });
  } catch (error) {
    console.error('Error fetching chapter submissions for coordinator:', error);
    res.status(500).json({ error: 'Failed to fetch chapter submissions' });
  }
}

module.exports = {
  getChapterSubmissionsForSupervisor,
  updateSubmissionApproval,
  getChapterSubmissionsForCoordinator,
};
