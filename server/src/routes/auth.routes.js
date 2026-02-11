const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Registration approval (admin only)
router.post('/approve-registration', authenticate, requireAdmin, controller.approveRegistration);

// Registration rejection (admin only)
router.post('/reject-registration', authenticate, requireAdmin, controller.rejectRegistration);

module.exports = router;
