const express = require('express');
const router = express.Router();
const controller = require('../controllers/groups.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Public — for registration page group selection
router.get('/available', controller.getAvailableGroups);

// Admin routes
router.get('/', authenticate, requireAdmin, controller.getAllGroups);
router.post('/:id/assign-supervisor', authenticate, requireAdmin, controller.assignSupervisor);
router.patch('/:id/status', authenticate, requireAdmin, controller.updateGroupStatus);

module.exports = router;
