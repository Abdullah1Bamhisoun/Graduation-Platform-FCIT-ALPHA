const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Public — submit a new registration (handles stale record cleanup via supabaseAdmin)
router.post('/submit-registration', controller.submitRegistration);

// Registration approval (admin only)
router.post('/approve-registration', authenticate, requireAdmin, controller.approveRegistration);

// Registration rejection (admin only)
router.post('/reject-registration', authenticate, requireAdmin, controller.rejectRegistration);

module.exports = router;
