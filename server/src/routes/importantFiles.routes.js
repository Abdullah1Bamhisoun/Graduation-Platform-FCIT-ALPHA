const express = require('express');
const router = express.Router();
const controller = require('../controllers/importantFiles.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Public — any authenticated (or even unauthenticated) user can list files
router.get('/', controller.listFiles);

// Admin only — manage files
router.post('/', authenticate, requireAdmin, controller.createFile);
router.patch('/:id', authenticate, requireAdmin, controller.updateFile);
router.delete('/:id', authenticate, requireAdmin, controller.deleteFile);

module.exports = router;
