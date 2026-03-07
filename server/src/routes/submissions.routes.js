const express = require('express');
const router = express.Router();
const controller = require('../controllers/submissions.controller');
const commentsController = require('../controllers/submissionComments.controller');
const {
  authenticate,
  requireSupervisorOrAdmin,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
} = require('../middleware/auth.middleware');

/**
 * Submission routes
 *
 * GET  /api/submissions/chapter-submissions
 *   Supervisor: list chapter submissions for all groups assigned to this supervisor.
 *
 * GET  /api/submissions/group-submission?milestoneId=X&groupId=Y
 *   Student (any group member): fetch the shared group submission for a milestone.
 *   Bypasses RLS via supabaseAdmin; access enforced by group membership check.
 *
 * GET  /api/submissions/group-milestone-statuses?groupId=X
 *   Student (any group member): fetch milestone_id→status map for a group.
 *   Bypasses RLS so all teammates see the same submission statuses on the milestone list.
 *
 * PATCH /api/submissions/:id/approval
 *   Supervisor: approve or reject a chapter submission.
 */

/**
 * Submission routes
 *
 * GET  /api/submissions/chapter-submissions
 *   Supervisor: list chapter submissions for all groups assigned to this supervisor.
 *   Backend-enforced filter by supervisor_id — supervisors cannot see other supervisors' groups.
 *
 * PATCH /api/submissions/:id/approval
 *   Supervisor: approve or reject a chapter submission.
 *   Grading remains entirely separate (coordinator-controlled grading scheme is unaffected).
 */

router.get(
  '/chapter-submissions',
  authenticate,
  requireSupervisorOrAdmin,
  controller.getChapterSubmissionsForSupervisor
);

// Student group-shared submission endpoints (bypass RLS via supabaseAdmin)
router.get('/group-submission', authenticate, controller.getGroupSubmission);
router.get('/group-milestone-statuses', authenticate, controller.getGroupMilestoneStatuses);

router.get(
  '/coordinator/chapter-submissions',
  authenticate,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
  controller.getChapterSubmissionsForCoordinator
);

router.patch(
  '/:id/approval',
  authenticate,
  requireSupervisorOrAdmin,
  controller.updateSubmissionApproval
);

/**
 * Discussion comment routes — accessible by the submission's student or their supervisor.
 * GET  /api/submissions/:id/comments — list all comments
 * POST /api/submissions/:id/comments — add a comment
 */
router.get('/:id/comments', authenticate, commentsController.getComments);
router.post('/:id/comments', authenticate, commentsController.addComment);

module.exports = router;
