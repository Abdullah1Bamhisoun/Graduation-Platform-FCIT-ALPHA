const express = require('express');
const router = express.Router();
const controller = require('../controllers/submissions.controller');
const { authenticate, requireSupervisorOrAdmin } = require('../middleware/auth.middleware');

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

router.patch(
  '/:id/approval',
  authenticate,
  requireSupervisorOrAdmin,
  controller.updateSubmissionApproval
);

module.exports = router;
