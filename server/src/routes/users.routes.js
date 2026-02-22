const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Admin: list all profiles; coordinators see only users in their course
router.get('/', authenticate, requireCoordinatorOrAdmin, controller.listUsers);

// Coordinator or Admin: delete a user by ID (coordinators cannot delete admin users)
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteUser);

module.exports = router;
