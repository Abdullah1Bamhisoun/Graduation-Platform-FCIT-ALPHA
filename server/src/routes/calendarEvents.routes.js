const express = require('express');
const router = express.Router();
const controller = require('../controllers/calendarEvents.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin, requireSupervisorOrCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Authenticated — list calendar events (auto-filtered by role)
router.get('/', authenticate, controller.listEvents);

// Supervisor/Coordinator/Admin — create events
// Supervisors must supply a groupId and can only create events for their own groups.
router.post('/', authenticate, requireSupervisorOrCoordinatorOrAdmin, controller.createEvent);

// Delete — supervisors can delete events they created for their groups; coordinators/admins can delete any
router.delete('/:id', authenticate, requireSupervisorOrCoordinatorOrAdmin, controller.deleteEvent);

module.exports = router;
