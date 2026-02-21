const express = require('express');
const router = express.Router();
const controller = require('../controllers/announcements.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { checkLocked } = require('../middleware/lock.middleware');

// Authenticated — list announcements (filter by ?role=student|supervisor|admin)
router.get('/', authenticate, controller.listAnnouncements);

// Coordinator or admin — create, update, delete (lock-protected)
router.post('/', authenticate, requireCoordinatorOrAdmin, checkLocked('announcements'), controller.createAnnouncement);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, checkLocked('announcements'), controller.updateAnnouncement);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, checkLocked('announcements'), controller.deleteAnnouncement);

module.exports = router;
