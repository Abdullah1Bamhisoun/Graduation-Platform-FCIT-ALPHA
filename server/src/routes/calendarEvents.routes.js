const express = require('express');
const router = express.Router();
const controller = require('../controllers/calendarEvents.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Authenticated — list all calendar events
router.get('/', authenticate, controller.listEvents);

// Admin only — create, delete
router.post('/', authenticate, requireAdmin, controller.createEvent);
router.delete('/:id', authenticate, requireAdmin, controller.deleteEvent);

module.exports = router;
