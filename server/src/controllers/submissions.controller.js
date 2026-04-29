const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');
const { normalizeCourseCode } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const { cacheGet, cacheSet, cacheDelPattern, TTL } = require('../utils/cache');

/**
 * Normalize a DB status value (underscore format) to the frontend format (hyphen format).
 * e.g. 'changes_requested' → 'changes-requested', 'under_review' → 'under-review'
 */
function normalizeStatus(status) {
  if (!status) return status;
  return status.replace(/_/g, '-');
}

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
        versions:submission_versions!submission_id(version, file_name, file_size, file_path, uploaded_at, notes)
      `)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false })
      .range(req.pagination.from, req.pagination.to);

    if (sError) throw sError;

    const submissionIds = (submissions || []).map((s) => s.id);

    // Step 3 — get feedback separately to avoid FK auto-detection issues
    let feedbackMap = {};
    if (submissionIds.length > 0) {
      const { data: feedbackRows } = await supabaseAdmin
        .from('submission_feedback')
        .select('id, submission_id, overall_comment, reviewed_by, reviewed_at')
        .in('submission_id', submissionIds)
        .order('reviewed_at', { ascending: false });

      (feedbackRows || []).forEach((f) => {
        if (!feedbackMap[f.submission_id]) feedbackMap[f.submission_id] = [];
        feedbackMap[f.submission_id].push(f);
      });
    }

    const result = (submissions || []).map((s) => {
      const feedbackArr = feedbackMap[s.id] || [];
      return {
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
        status: normalizeStatus(s.status),
        currentVersion: s.current_version,
        submittedAt: s.updated_at ?? s.created_at,
        versions: (s.versions || []).sort((a, b) => a.version - b.version),
        hasFeedback: feedbackArr.length > 0,
        latestFeedback: feedbackArr[0] ?? null,
      };
    });

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

    if (!['approve', 'request_changes'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "request_changes"' });
    }

    if (action === 'request_changes' && (!feedback || !feedback.trim())) {
      return res.status(400).json({ error: 'Feedback is required when requesting changes' });
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
    // DB enum uses underscores; frontend display uses hyphens (mapped in mappers.ts)
    const newStatus = action === 'approve' ? 'approved' : 'changes_requested';

    // Update submission status
    const { error: updateError } = await supabaseAdmin
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', submissionId);

    if (updateError) {
      console.error('submissions.update error:', updateError);
      return res.status(500).json({
        error: `Failed to update submission status: ${updateError.message}`,
        detail: updateError.details || updateError.hint || null,
      });
    }

    await cacheDelPattern('submissions:coordinator:*');

    // Store the review feedback — upsert so re-approving/re-rejecting doesn't
    // crash on a duplicate submission_id unique constraint.
    if (feedback || action === 'reject') {
      const { error: fbError } = await supabaseAdmin
        .from('submission_feedback')
        .upsert(
          {
            submission_id: submissionId,
            overall_comment: feedback?.trim() || '',
            reviewed_by: req.user.id,
            total_score: 0,
            max_score: 0,
          },
          { onConflict: 'submission_id', ignoreDuplicates: false }
        );

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

    // ── Fire-and-forget email + notifications to students ───────────────────
    ;(async () => {
      try {
        const [{ data: memberRows }, { data: subDetail }] = await Promise.all([
          supabaseAdmin.from('group_members').select('student_id').eq('group_id', submission.group_id),
          supabaseAdmin.from('submissions')
            .select('milestone:milestones!milestone_id(name, course:courses!course_id(code))')
            .eq('id', submissionId)
            .single(),
        ]);

        const studentIds = (memberRows || []).map((m) => m.student_id);
        const mileName   = subDetail?.milestone?.name ?? 'Submission';
        const courseCode = normalizeCourseCode(subDetail?.milestone?.course?.code ?? '');
        const decisionLabel = action === 'approve' ? 'Approved' : 'Changes Requested';

        if (studentIds.length > 0) {
          const { data: studentProfiles } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .in('id', studentIds);

          const emails = (studentProfiles || []).map((p) => p.email).filter(Boolean);
          if (emails.length > 0) {
            emailService.sendSubmissionDecision(emails, {
              status: decisionLabel,
              feedback: feedback ?? '',
              milestoneName: mileName,
              courseName: courseCode,
            }).catch(console.error);
          }

          // ── Trigger 4 (approval path): announcement + notification ─────────
          const courseId = await notificationService.getCourseIdFromGroup(submission.group_id);
          const today    = new Date().toISOString().slice(0, 10);

          await Promise.all([
            notificationService.createAnnouncement({
              title:       `Submission Review: ${mileName} — ${decisionLabel}`,
              content:     `Your supervisor reviewed "${mileName}".\nDecision: ${decisionLabel}${feedback ? `\n\nFeedback: ${feedback}` : ''}`,
              targetRoles: ['student'],
              courseId,
              groupId:     submission.group_id,
              authorId:    req.user.id,
            }),
            notificationService.createUserNotifications(studentIds, {
              type:    'grade',
              title:   `Submission ${decisionLabel}`,
              message: `Your "${mileName}" submission has been ${decisionLabel.toLowerCase()}.`,
              link:    '/student/milestones',
            }),
          ]);
        }
      } catch (emailErr) {
        console.error('[submissions] Failed to send decision notification:', emailErr.message);
      }
    })();

    res.json({ success: true, newStatus });
  } catch (error) {
    console.error('Error updating submission approval:', error);
    res.status(500).json({
      error: 'Failed to update submission',
      detail: error?.details || error?.hint || null,
    });
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
    const isAdmin = req.user.activeRole === 'admin' || (req.user.roles || []).includes('admin');

    const ck = `submissions:coordinator:${coordinatorId}:${courseType ?? 'all'}:${filterGroup ?? 'all'}:${req.pagination.from}-${req.pagination.to}`;
    const cached = await cacheGet(ck);
    if (cached) return res.json(cached);

    // Step 1 — resolve course ID(s)
    // Admins ALWAYS use courseType lookup (never constrained to a single coordinatorCourseId)
    let coordinatorCourseId = isAdmin ? null : req.user.coordinatorCourseId;
    let adminCourseIds = null;

    if (isAdmin) {
      if (!courseType || !['498', '499'].includes(courseType)) {
        return res.status(400).json({ error: 'courseType (498 or 499) is required for admin' });
      }
      const { data: courseRows } = await supabaseAdmin
        .from('courses')
        .select('id')
        .ilike('code', `%${courseType}%`);
      adminCourseIds = (courseRows || []).map((r) => r.id);
    } else {
      if (!coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
    }

    // Step 2 — get all groups in the assigned course
    // Admins use OR(course_number, course_id) to cover both legacy and UUID-based groups
    let groupQuery = supabaseAdmin
      .from('groups')
      .select('id, group_number, project_name');

    if (isAdmin) {
      if (adminCourseIds && adminCourseIds.length > 0) {
        groupQuery = groupQuery.or(`course_number.eq.${courseType},course_id.in.(${adminCourseIds.join(',')})`);
      } else {
        groupQuery = groupQuery.eq('course_number', courseType);
      }
    } else {
      groupQuery = groupQuery.eq('course_id', coordinatorCourseId);
    }

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
        versions:submission_versions!submission_id(version, file_name, file_size, file_path, uploaded_at, notes)
      `)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false })
      .range(req.pagination.from, req.pagination.to);

    if (sError) throw sError;

    const submissionIds = (submissions || []).map((s) => s.id);

    // Get feedback separately to avoid FK auto-detection issues
    let feedbackMap = {};
    if (submissionIds.length > 0) {
      const { data: feedbackRows } = await supabaseAdmin
        .from('submission_feedback')
        .select('id, submission_id, overall_comment, reviewed_by, reviewed_at')
        .in('submission_id', submissionIds)
        .order('reviewed_at', { ascending: false });

      (feedbackRows || []).forEach((f) => {
        if (!feedbackMap[f.submission_id]) feedbackMap[f.submission_id] = [];
        feedbackMap[f.submission_id].push(f);
      });
    }

    const result = (submissions || []).map((s) => {
      const feedbackArr = feedbackMap[s.id] || [];
      return {
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
        status: normalizeStatus(s.status),
        currentVersion: s.current_version,
        submittedAt: s.updated_at ?? s.created_at,
        versions: (s.versions || []).sort((a, b) => a.version - b.version),
        hasFeedback: feedbackArr.length > 0,
        latestFeedback: feedbackArr[0] ?? null,
      };
    });

    // Step 4 — calculate statistics (statuses are already normalized to hyphen format)
    const stats = {
      total: result.length,
      pending: result.filter((s) => s.status === 'submitted' || s.status === 'under-review').length,
      approved: result.filter((s) => s.status === 'approved').length,
      rejected: result.filter((s) => s.status === 'changes-requested').length,
    };

    const payload = { submissions: result, stats };
    await cacheSet(ck, payload, TTL.SHORT);
    res.json(payload);
  } catch (error) {
    console.error('Error fetching chapter submissions for coordinator:', error);
    res.status(500).json({ error: 'Failed to fetch chapter submissions' });
  }
}

/**
 * GET /api/submissions/group-submission?milestoneId=X&groupId=Y
 *
 * Student endpoint: returns the shared group submission for a milestone.
 * Uses supabaseAdmin to bypass RLS — access is enforced by verifying the
 * requesting user is a member of the specified group.
 */
async function getGroupSubmission(req, res) {
  try {
    const { milestoneId, groupId } = req.query;
    if (!milestoneId || !groupId) {
      return res.status(400).json({ error: 'milestoneId and groupId are required' });
    }

    const userId = req.user.id;
    const userRoles = req.user.roles;

    // Admins and supervisors can access without group membership check
    if (!userRoles.includes('admin') && !userRoles.includes('supervisor')) {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('student_id', userId)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a member of this group' });
      }
    }

    const { data: submission, error } = await supabaseAdmin
      .from('submissions')
      .select(`
        id, milestone_id, student_id, group_id, status, current_version, created_at, updated_at,
        milestone:milestones!milestone_id(name, course:courses!course_id(code)),
        student:profiles!student_id(name),
        group:groups!group_id(project_name),
        versions:submission_versions(version, file_name, file_size, file_path, uploaded_at, notes),
        feedback:submission_feedback(
          id, overall_comment, reviewed_by, reviewed_at, total_score, max_score,
          reviewer:profiles!reviewed_by(name),
          scores:feedback_scores(score, comment, criterion:rubric_criteria!rubric_criterion_id(id, name, max_score))
        )
      `)
      .eq('milestone_id', milestoneId)
      .eq('group_id', groupId)
      .maybeSingle();

    if (error) throw error;
    if (!submission) return res.json(null);

    // Fetch all group members separately (Supabase nested join depth limit)
    const { data: memberRows } = await supabaseAdmin
      .from('group_members')
      .select('student_id, student:profiles!student_id(id, name)')
      .eq('group_id', groupId);

    const groupMembers = (memberRows || []).map((m) => ({
      id: m.student?.id ?? m.student_id,
      name: m.student?.name ?? '',
    })).filter((m) => m.id);

    const feedbackData = Array.isArray(submission.feedback)
      ? submission.feedback[0]
      : submission.feedback;

    const mapped = {
      id: submission.id,
      milestoneId: submission.milestone_id,
      milestoneName: submission.milestone?.name ?? '',
      studentId: submission.student_id,
      studentName: submission.student?.name ?? '',
      projectName: submission.group?.project_name ?? '',
      submittedAt: submission.updated_at ?? submission.created_at,
      status: normalizeStatus(submission.status),
      currentVersion: submission.current_version,
      groupId: submission.group_id,
      groupMembers,
      versions: (submission.versions || [])
        .sort((a, b) => a.version - b.version)
        .map((v) => ({
          version: v.version,
          fileName: v.file_name,
          fileSize: v.file_size,
          filePath: v.file_path ?? undefined,
          uploadedAt: v.uploaded_at,
          notes: v.notes ?? undefined,
        })),
      feedback: feedbackData
        ? {
            rubric: (feedbackData.scores || []).map((s) => ({
              id: s.criterion?.id ?? '',
              name: s.criterion?.name ?? '',
              maxScore: s.criterion?.max_score ?? 0,
              score: Number(s.score),
              comment: s.comment ?? undefined,
            })),
            overallComment: feedbackData.overall_comment ?? '',
            reviewedBy: feedbackData.reviewer?.name ?? '',
            reviewedAt: feedbackData.reviewed_at,
            totalScore: Number(feedbackData.total_score ?? 0),
            maxScore: Number(feedbackData.max_score ?? 0),
          }
        : undefined,
    };

    res.json(mapped);
  } catch (error) {
    console.error('Error fetching group submission:', error);
    res.status(500).json({ error: 'Failed to fetch group submission' });
  }
}

/**
 * GET /api/submissions/group-milestone-statuses?groupId=X
 *
 * Student endpoint: returns milestone_id → status map for a group.
 * Bypasses RLS so all group members see the same submission statuses.
 */
async function getGroupMilestoneStatuses(req, res) {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    const userId = req.user.id;
    const userRoles = req.user.roles;

    if (!userRoles.includes('admin') && !userRoles.includes('supervisor')) {
      const { data: membership } = await supabaseAdmin
        .from('group_members')
        .select('student_id')
        .eq('group_id', groupId)
        .eq('student_id', userId)
        .maybeSingle();

      if (!membership) {
        return res.status(403).json({ error: 'Access denied: not a member of this group' });
      }
    }

    const { data: submissions, error } = await supabaseAdmin
      .from('submissions')
      .select('milestone_id, status')
      .eq('group_id', groupId);

    if (error) throw error;

    const statuses = Object.fromEntries(
      (submissions || []).map((s) => [s.milestone_id, normalizeStatus(s.status)])
    );

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching group milestone statuses:', error);
    res.status(500).json({ error: 'Failed to fetch milestone statuses' });
  }
}

/**
 * POST /api/submissions
 *
 * Student endpoint — creates a new submission record + first version.
 * Runs server-side (supabaseAdmin) so we can fire the supervisor email notification.
 *
 * Body: { milestoneId, studentId, groupId, fileName, fileSize, filePath, notes? }
 */
async function createSubmission(req, res) {
  try {
    const { milestoneId, studentId, groupId, fileName, fileSize, filePath, notes } = req.body;

    if (!milestoneId || !studentId || !groupId || !fileName || !fileSize || !filePath) {
      return res.status(400).json({ error: 'milestoneId, studentId, groupId, fileName, fileSize, and filePath are required' });
    }

    // Verify the requester is a member of the group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('student_id')
      .eq('group_id', groupId)
      .eq('student_id', req.user.id)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: you are not a member of this group' });
    }

    // Create the submission record
    const { data: submission, error: sError } = await supabaseAdmin
      .from('submissions')
      .insert({ milestone_id: milestoneId, student_id: studentId, group_id: groupId, status: 'submitted', current_version: 1 })
      .select('id')
      .single();

    if (sError) throw sError;

    // Create the first version
    const { error: vError } = await supabaseAdmin
      .from('submission_versions')
      .insert({ submission_id: submission.id, version: 1, file_name: fileName, file_size: fileSize, file_path: filePath, notes: notes ?? null });

    if (vError) throw vError;

    // ── Fire-and-forget email + notifications to supervisor ───────────────────
    ;(async () => {
      try {
        const [{ data: group }, { data: milestone }] = await Promise.all([
          supabaseAdmin.from('groups').select('supervisor_id, group_number').eq('id', groupId).single(),
          supabaseAdmin.from('milestones').select('name, due_date, course:courses!course_id(code)').eq('id', milestoneId).single(),
        ]);

        if (group?.supervisor_id) {
          const { data: supervisorProfile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', group.supervisor_id)
            .single();

          if (supervisorProfile?.email) {
            emailService.sendSubmissionReceived(supervisorProfile.email, {
              studentName: req.user.name || 'Student',
              milestoneName: milestone?.name ?? '',
              courseName: normalizeCourseCode(milestone?.course?.code ?? ''),
              submittedAt: new Date().toISOString(),
            }).catch(console.error);
          }

          // ── Trigger 1: announcement + notification + personal calendar ─────
          const courseId = await notificationService.getCourseIdFromGroup(groupId);
          const today    = new Date().toISOString().slice(0, 10);
          const groupNum = group.group_number ?? '';
          const mileName = milestone?.name ?? 'Submission';
          const dueDate  = milestone?.due_date ? milestone.due_date.slice(0, 10) : today;

          await Promise.all([
            notificationService.createAnnouncement({
              title:       `New Submission: ${mileName}`,
              content:     `${req.user.name || 'A student'} uploaded a new file for "${mileName}"${groupNum ? ` (Group ${groupNum})` : ''}.\nSubmitted: ${new Date().toLocaleString('en-US')}`,
              targetRoles: ['supervisor'],
              courseId,
              groupId,
              authorId:    req.user.id,
            }),
            notificationService.createUserNotifications([group.supervisor_id], {
              type:    'submission',
              title:   'New Submission Received',
              message: `${req.user.name || 'A student'} submitted "${mileName}"${groupNum ? ` for Group ${groupNum}` : ''}.`,
              link:    '/supervisor/submissions',
            }),
          ]);
        }
      } catch (emailErr) {
        console.error('[submissions] Failed to send submission notification:', emailErr.message);
      }
    })();

    res.json({ success: true, submissionId: submission.id });
  } catch (error) {
    console.error('Error creating submission:', error);
    res.status(500).json({ error: 'Failed to create submission' });
  }
}

/**
 * POST /api/submissions/:id/versions
 *
 * Student endpoint — adds a new version to an existing submission.
 * Runs server-side so we can fire the supervisor email notification.
 *
 * Body: { version, fileName, fileSize, filePath, notes? }
 */
async function createSubmissionVersion(req, res) {
  try {
    const { id: submissionId } = req.params;
    const { version, fileName, fileSize, filePath, notes } = req.body;

    if (!version || !fileName || !fileSize || !filePath) {
      return res.status(400).json({ error: 'version, fileName, fileSize, and filePath are required' });
    }

    // Fetch the submission to verify ownership
    const { data: submission, error: fetchErr } = await supabaseAdmin
      .from('submissions')
      .select('id, group_id, milestone_id, student_id')
      .eq('id', submissionId)
      .single();

    if (fetchErr || !submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Verify requester is a member of the group
    const { data: membership } = await supabaseAdmin
      .from('group_members')
      .select('student_id')
      .eq('group_id', submission.group_id)
      .eq('student_id', req.user.id)
      .maybeSingle();

    if (!membership) {
      return res.status(403).json({ error: 'Access denied: you are not a member of this group' });
    }

    // Insert the new version
    const { error: vError } = await supabaseAdmin
      .from('submission_versions')
      .insert({ submission_id: submissionId, version, file_name: fileName, file_size: fileSize, file_path: filePath, notes: notes ?? null });

    if (vError) throw vError;

    // Update submission's current_version and reset status to 'submitted'
    const { error: uError } = await supabaseAdmin
      .from('submissions')
      .update({ current_version: version, status: 'submitted' })
      .eq('id', submissionId);

    if (uError) throw uError;

    // ── Fire-and-forget email + notifications to supervisor ───────────────────
    ;(async () => {
      try {
        const [{ data: group }, { data: milestone }] = await Promise.all([
          supabaseAdmin.from('groups').select('supervisor_id, group_number').eq('id', submission.group_id).single(),
          supabaseAdmin.from('milestones').select('name, due_date, course:courses!course_id(code)').eq('id', submission.milestone_id).single(),
        ]);

        if (group?.supervisor_id) {
          const { data: supervisorProfile } = await supabaseAdmin
            .from('profiles')
            .select('email')
            .eq('id', group.supervisor_id)
            .single();

          if (supervisorProfile?.email) {
            emailService.sendSubmissionReceived(supervisorProfile.email, {
              studentName: req.user.name || 'Student',
              milestoneName: milestone?.name ?? '',
              courseName: normalizeCourseCode(milestone?.course?.code ?? ''),
              submittedAt: new Date().toISOString(),
            }).catch(console.error);
          }

          // ── Trigger 1: announcement + notification + personal calendar ─────
          const courseId = await notificationService.getCourseIdFromGroup(submission.group_id);
          const today    = new Date().toISOString().slice(0, 10);
          const groupNum = group.group_number ?? '';
          const mileName = milestone?.name ?? 'Submission';
          const dueDate  = milestone?.due_date ? milestone.due_date.slice(0, 10) : today;

          await Promise.all([
            notificationService.createAnnouncement({
              title:       `Updated Submission: ${mileName} (v${version})`,
              content:     `${req.user.name || 'A student'} uploaded revision v${version} for "${mileName}"${groupNum ? ` (Group ${groupNum})` : ''}.\nSubmitted: ${new Date().toLocaleString('en-US')}`,
              targetRoles: ['supervisor'],
              courseId,
              groupId:     submission.group_id,
              authorId:    req.user.id,
            }),
            notificationService.createUserNotifications([group.supervisor_id], {
              type:    'submission',
              title:   `Submission Updated: ${mileName}`,
              message: `${req.user.name || 'A student'} uploaded revision v${version}${groupNum ? ` for Group ${groupNum}` : ''}.`,
              link:    '/supervisor/submissions',
            }),
          ]);
        }
      } catch (emailErr) {
        console.error('[submissions] Failed to send version notification:', emailErr.message);
      }
    })();

    res.json({ success: true });
  } catch (error) {
    console.error('Error creating submission version:', error);
    res.status(500).json({ error: 'Failed to create submission version' });
  }
}

/**
 * GET /api/submissions/committee-eval?groupId=X
 *
 * Returns milestone submissions for committee evaluation.
 * Fetches all milestones with include_in_committee_eval=true for the group's course,
 * then finds the group's submission (if any) for each and returns the latest file version.
 * Accessible by supervisors, committee members, and coordinators.
 */
async function getCommitteeEvalSubmissions(req, res) {
  try {
    const { groupId } = req.query;
    if (!groupId) {
      return res.status(400).json({ error: 'groupId is required' });
    }

    // Resolve the group's course_id
    const { data: group, error: gError } = await supabaseAdmin
      .from('groups')
      .select('id, course_id')
      .eq('id', groupId)
      .single();

    if (gError || !group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (!group.course_id) {
      return res.json([]);
    }

    // Fetch milestones flagged for committee eval in this course
    const { data: milestones, error: mError } = await supabaseAdmin
      .from('milestones')
      .select('id, name, due_date')
      .eq('course_id', group.course_id)
      .eq('include_in_committee_eval', true)
      .order('due_date');

    if (mError) throw mError;
    if (!milestones || milestones.length === 0) return res.json([]);

    const milestoneIds = milestones.map((m) => m.id);

    // Fetch submissions for this group for those milestones
    const { data: submissions, error: sError } = await supabaseAdmin
      .from('submissions')
      .select(`
        id, milestone_id, student_id, status, current_version, updated_at, created_at,
        student:profiles!student_id(id, name),
        versions:submission_versions!submission_id(version, file_name, file_size, file_path, uploaded_at, notes)
      `)
      .eq('group_id', groupId)
      .in('milestone_id', milestoneIds);

    if (sError) throw sError;

    const submissionByMilestone = Object.fromEntries(
      (submissions || []).map((s) => [s.milestone_id, s])
    );

    const result = milestones.map((m) => {
      const sub = submissionByMilestone[m.id] ?? null;
      let latestVersion = null;
      if (sub && sub.versions && sub.versions.length > 0) {
        latestVersion = sub.versions.reduce((a, b) => (a.version > b.version ? a : b));
      }
      return {
        milestoneId: m.id,
        milestoneName: m.name,
        dueDate: m.due_date,
        submissionId: sub?.id ?? null,
        status: sub ? normalizeStatus(sub.status) : null,
        submitterName: sub?.student?.name ?? null,
        submittedAt: sub ? (sub.updated_at ?? sub.created_at) : null,
        latestVersion: latestVersion
          ? {
              version: latestVersion.version,
              fileName: latestVersion.file_name,
              fileSize: latestVersion.file_size,
              filePath: latestVersion.file_path,
              uploadedAt: latestVersion.uploaded_at,
              notes: latestVersion.notes ?? null,
            }
          : null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching committee eval submissions:', error);
    res.status(500).json({ error: 'Failed to fetch committee eval submissions' });
  }
}

module.exports = {
  getChapterSubmissionsForSupervisor,
  updateSubmissionApproval,
  getChapterSubmissionsForCoordinator,
  getGroupSubmission,
  getGroupMilestoneStatuses,
  createSubmission,
  createSubmissionVersion,
  getCommitteeEvalSubmissions,
};
