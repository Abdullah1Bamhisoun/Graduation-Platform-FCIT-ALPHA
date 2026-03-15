const express = require('express');
const router = express.Router();
const controller = require('../controllers/importantFiles.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// authenticate: required so the server can scope files by role/course
router.get('/', authenticate, controller.listFiles);

// Admin or coordinator — manage files
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createFile);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateFile);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteFile);

module.exports = router;
