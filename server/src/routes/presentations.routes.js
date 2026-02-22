const express = require('express');
const router = express.Router();
const controller = require('../controllers/presentations.controller');
const {
  authenticate,
  requireRole,
  requireCoordinatorOrAdmin,
} = require('../middleware/auth.middleware');

/**
 * GET /api/presentations/student-view
 * Students only: returns their group number + assigned presentation time.
 * Supervisor name is excluded server-side.
 */
router.get(
  '/student-view',
  authenticate,
  requireRole(['student']),
  controller.getStudentPresentationView
);

/**
 * GET /api/presentations/by-course?courseId=<uuid>
 * Admin (any course) or Coordinator (own course only).
 */
router.get(
  '/by-course',
  authenticate,
  requireCoordinatorOrAdmin,
  controller.getPresentationsByCourse
);

/**
 * GET /api/presentations/server-time
 * Authenticated — returns current server UTC timestamp.
 * Frontend uses this to validate date selection without relying on browser time.
 */
router.get('/server-time', authenticate, controller.getServerTime);

/**
 * POST /api/presentations/assign
 * Admin or Coordinator — create / update a presentation schedule with real-date
 * validation, auto-calendar-event, and auto-announcement.
 */
router.post(
  '/assign',
  authenticate,
  requireCoordinatorOrAdmin,
  controller.assignSchedule
);

/**
 * DELETE /api/presentations/schedule/:groupId
 * Admin or Coordinator — remove a schedule and its linked calendar event.
 */
router.delete(
  '/schedule/:groupId',
  authenticate,
  requireCoordinatorOrAdmin,
  controller.deleteSchedule
);

module.exports = router;
