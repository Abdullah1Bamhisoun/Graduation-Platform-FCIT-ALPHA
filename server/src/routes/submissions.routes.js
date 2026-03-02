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
