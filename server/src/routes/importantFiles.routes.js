const express = require('express');
const router = express.Router();
const controller = require('../controllers/importantFiles.controller');
const { authenticate, optionalAuth, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// optionalAuth: lets the controller scope the list by course when coordinator is logged in
router.get('/', optionalAuth, controller.listFiles);

// Admin or coordinator — manage files
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createFile);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateFile);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteFile);

module.exports = router;
