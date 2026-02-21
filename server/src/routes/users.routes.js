const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Admin: list all profiles; coordinators see only users in their course
router.get('/', authenticate, requireCoordinatorOrAdmin, controller.listUsers);

// Admin: delete a user by ID
router.delete('/:id', authenticate, requireAdmin, controller.deleteUser);

module.exports = router;
