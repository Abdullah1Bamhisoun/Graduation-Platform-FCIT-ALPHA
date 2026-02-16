const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Admin: list all profiles, optionally filtered by role (?role=supervisor)
router.get('/', authenticate, requireAdmin, controller.listUsers);

// Admin: delete a user by ID
router.delete('/:id', authenticate, requireAdmin, controller.deleteUser);

module.exports = router;
