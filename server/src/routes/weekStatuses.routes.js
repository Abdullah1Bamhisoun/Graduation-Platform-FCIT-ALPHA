const express = require('express');
const router = express.Router();
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const controller = require('../controllers/weekStatuses.controller');

// GET /api/week-statuses?courseType=498&semester=DEFAULT&department=IS
router.get('/', authenticate, requireCoordinatorOrAdmin, controller.getWeekStatuses);

// PATCH /api/week-statuses/:id/open
router.patch('/:id/open', authenticate, requireCoordinatorOrAdmin, controller.openWeek);

// PATCH /api/week-statuses/:id/close
router.patch('/:id/close', authenticate, requireCoordinatorOrAdmin, controller.closeWeek);

// PATCH /api/week-statuses/:id/lock
router.patch('/:id/lock', authenticate, requireCoordinatorOrAdmin, controller.lockWeek);

module.exports = router;
