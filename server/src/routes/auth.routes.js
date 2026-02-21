const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Public — submit a new registration (handles stale record cleanup via supabaseAdmin)
router.post('/submit-registration', controller.submitRegistration);

// List registrations — admin sees all, coordinator sees only their course
router.get('/pending-registrations', authenticate, requireCoordinatorOrAdmin, controller.listRegistrations);

// Admin: retroactively create missing groups for already-approved students
router.post('/repair-groups', authenticate, requireAdmin, controller.repairGroups);

// Registration approval/rejection — accessible by coordinator (course-scoped) or admin
router.post('/approve-registration', authenticate, requireCoordinatorOrAdmin, controller.approveRegistration);
router.post('/reject-registration', authenticate, requireCoordinatorOrAdmin, controller.rejectRegistration);

module.exports = router;
