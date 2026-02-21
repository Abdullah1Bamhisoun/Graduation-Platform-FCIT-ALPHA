const express = require('express');
const router = express.Router();
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const controller = require('../controllers/roles.controller');

// Log a role switch event (authenticated users only)
router.post('/switch', authenticate, controller.switchRole);

// Return all roles for the authenticated user
router.get('/mine', authenticate, controller.getMyRoles);

// Return coordinator course info for the authenticated user (always fresh from DB)
router.get('/coordinator-info', authenticate, controller.getCoordinatorInfo);

// Admin-only: assign / revoke roles
router.post('/assign', authenticate, requireAdmin, controller.assignRole);
router.delete('/revoke', authenticate, requireAdmin, controller.revokeRole);
// Coordinator or admin: list coordinators
router.get('/coordinators', authenticate, requireCoordinatorOrAdmin, controller.getCoordinators);

module.exports = router;
