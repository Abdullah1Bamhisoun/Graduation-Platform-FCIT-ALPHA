const express = require('express');
const router = express.Router();
const controller = require('../controllers/importantFiles.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// Public — any authenticated (or even unauthenticated) user can list files
router.get('/', controller.listFiles);

// Admin or coordinator — manage files
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createFile);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateFile);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteFile);

module.exports = router;
