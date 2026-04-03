const express = require('express');
const router = express.Router();
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const controller = require('../controllers/weekStatuses.controller');

// GET /api/week-statuses?courseType=498&semester=DEFAULT&department=IS
// Any authenticated user (students, supervisors, coordinators) needs to read week statuses.
router.get('/', authenticate, controller.getWeekStatuses);

// PATCH /api/week-statuses/:id/open
router.patch('/:id/open', authenticate, requireCoordinatorOrAdmin, controller.openWeek);

// PATCH /api/week-statuses/:id/close
router.patch('/:id/close', authenticate, requireCoordinatorOrAdmin, controller.closeWeek);

// PATCH /api/week-statuses/:id/lock
router.patch('/:id/lock', authenticate, requireCoordinatorOrAdmin, controller.lockWeek);

// PATCH /api/week-statuses/:id/deadline
// Body: { open_at?: ISO string, close_at?: ISO string }
router.patch('/:id/deadline', authenticate, requireCoordinatorOrAdmin, controller.setDeadline);

module.exports = router;
