const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcements.controller');
const { authenticate, requireAdmin } = require('../middleware/auth.middleware');

// Authenticated — list announcements (filter by ?role=student|supervisor|admin)
router.get('/', authenticate, controller.listAnnouncements);

// Admin only — create, update, delete
router.post('/', authenticate, requireAdmin, controller.createAnnouncement);
router.patch('/:id', authenticate, requireAdmin, controller.updateAnnouncement);
router.delete('/:id', authenticate, requireAdmin, controller.deleteAnnouncement);

module.exports = router;
