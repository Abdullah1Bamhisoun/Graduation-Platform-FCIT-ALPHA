const express = require('express');
const router = express.Router();
const controller = require('../controllers/calendarEvents.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Authenticated — list calendar events (auto-filtered by role)
router.get('/', authenticate, controller.listEvents);

// Coordinator or Admin — create, delete
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createEvent);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteEvent);

module.exports = router;
