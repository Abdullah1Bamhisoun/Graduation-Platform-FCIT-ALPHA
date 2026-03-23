const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/announcements.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { checkLocked } = require('../middleware/lock.middleware');
const { validate } = require('../middleware/validate.middleware');
const { paginate } = require('../middleware/paginate.middleware');
const {
  createAnnouncementSchema,
  updateAnnouncementSchema,
} = require('../schemas/domain.schemas');

// Authenticated — list announcements; capped at 200 to prevent full-table scan
router.get(
  '/',
  authenticate,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.listAnnouncements
);

// Coordinator or admin — create (lock-protected + validated)
router.post(
  '/',
  authenticate,
  requireCoordinatorOrAdmin,
  checkLocked('announcements'),
  validate(createAnnouncementSchema),
  controller.createAnnouncement
);

// Coordinator or admin — update (lock-protected + validated)
router.patch(
  '/:id',
  authenticate,
  requireCoordinatorOrAdmin,
  checkLocked('announcements'),
  validate(updateAnnouncementSchema),
  controller.updateAnnouncement
);

// Coordinator or admin — delete
router.delete(
  '/:id',
  authenticate,
  requireCoordinatorOrAdmin,
  checkLocked('announcements'),
  controller.deleteAnnouncement
);

module.exports = router;
