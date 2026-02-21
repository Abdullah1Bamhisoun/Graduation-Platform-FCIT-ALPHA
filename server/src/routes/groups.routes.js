const express = require('express');
const router = express.Router();
const controller = require('../controllers/groups.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { checkLocked } = require('../middleware/lock.middleware');

// Public — for registration page group selection
router.get('/available', controller.getAvailableGroups);

// Coordinator (course-scoped) or admin (all groups)
router.get('/', authenticate, requireCoordinatorOrAdmin, controller.getAllGroups);
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createGroup);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateGroup);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteGroup);
router.post('/:id/assign-supervisor', authenticate, requireCoordinatorOrAdmin, controller.assignSupervisor);
router.patch('/:id/status', authenticate, requireCoordinatorOrAdmin, controller.updateGroupStatus);

module.exports = router;
