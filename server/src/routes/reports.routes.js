'use strict';

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/reports.controller');
const { authenticate, requireSupervisorOrAdmin } = require('../middleware/auth.middleware');

/**
 * POST /api/reports
 * Student submits (or re-submits) a weekly report for their group.
 * Fires Trigger 2: auto-announcement + notification + calendar for supervisor.
 */
router.post('/', authenticate, controller.submitWeeklyReport);

/**
 * GET /api/reports?groupId=X
 * List all weekly reports for a group.
 * Accessible by: group members, supervisor of the group, coordinator, admin.
 */
router.get('/', authenticate, controller.listReports);

/**
 * PATCH /api/reports/:id/status
 * Supervisor marks a report as reviewed or requests changes.
 */
router.patch('/:id/status', authenticate, requireSupervisorOrAdmin, controller.updateReportStatus);

/**
 * POST /api/reports/:id/comments
 * Add a comment to a weekly report (supervisor feedback or student question).
 * Fires Trigger 5 when the author is a supervisor: notifies all group students.
 */
router.post('/:id/comments', authenticate, controller.addReportComment);

/**
 * GET /api/reports/:id/comments
 * List all comments for a weekly report.
 */
router.get('/:id/comments', authenticate, controller.listReportComments);

/**
 * POST /api/reports/:id/notify-supervisor-response
 * Fire emails + in-app notifications + announcement after the supervisor
 * responds to a weekly report (the response itself is written client-side).
 */
router.post(
  '/:id/notify-supervisor-response',
  authenticate,
  requireSupervisorOrAdmin,
  controller.notifySupervisorResponse,
);

/**
 * POST /api/reports/:id/notify-submission
 * Fire supervisor email + announcement + in-app notification after a student
 * submits a weekly report (the submission itself is written client-side).
 */
router.post(
  '/:id/notify-submission',
  authenticate,
  controller.notifySubmission,
);

module.exports = router;
