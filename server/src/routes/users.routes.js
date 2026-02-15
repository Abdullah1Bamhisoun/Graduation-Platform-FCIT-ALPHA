const express = require('express');
const router = express.Router();
const controller = require('../controllers/users.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Admin: delete a user by ID
router.delete('/:id', authenticate, requireAdmin, controller.deleteUser);

module.exports = router;
