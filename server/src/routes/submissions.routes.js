const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/submissions.controller');
const commentsController = require('../controllers/submissionComments.controller');
const {
  authenticate,
  requireSupervisorOrAdmin,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
} = require('../middleware/auth.middleware');
const { idempotency } = require('../middleware/idempotency.middleware');
const { paginate }    = require('../middleware/paginate.middleware');
const { validate }    = require('../middleware/validate.middleware');
const {
  createSubmissionSchema,
  createSubmissionVersionSchema,
  updateSubmissionApprovalSchema,
  addCommentSchema,
} = require('../schemas/domain.schemas');

// Supervisor: list chapter submissions for their assigned groups
router.get(
  '/chapter-submissions',
  authenticate,
  requireSupervisorOrAdmin,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.getChapterSubmissionsForSupervisor
);

// Student: fetch the shared group submission for a milestone
router.get('/group-submission',         authenticate, controller.getGroupSubmission);
router.get('/group-milestone-statuses', authenticate, controller.getGroupMilestoneStatuses);

// Committee eval: milestone submissions flagged for committee review
router.get('/committee-eval', authenticate, controller.getCommitteeEvalSubmissions);

// Coordinator: chapter submissions for their assigned course
router.get(
  '/coordinator/chapter-submissions',
  authenticate,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.getChapterSubmissionsForCoordinator
);

// Supervisor: approve or request changes on a submission
router.patch(
  '/:id/approval',
  authenticate,
  requireSupervisorOrAdmin,
  validate(updateSubmissionApprovalSchema),
  controller.updateSubmissionApproval
);

// Student: create new submission — idempotency prevents duplicates on retry/double-click
router.post(
  '/',
  authenticate,
  idempotency({ ttlHours: 24 }),
  validate(createSubmissionSchema),
  controller.createSubmission
);

// Student: add a new version — idempotency prevents duplicate uploads
router.post(
  '/:id/versions',
  authenticate,
  idempotency({ ttlHours: 24 }),
  validate(createSubmissionVersionSchema),
  controller.createSubmissionVersion
);

// Discussion comments
router.get( '/:id/comments', authenticate, commentsController.getComments);
router.post(
  '/:id/comments',
  authenticate,
  validate(addCommentSchema),
  commentsController.addComment
);

module.exports = router;
