const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/announcements.controller');
const { authenticate, requireCoordinatorOrAdmin, requireSupervisorOrCoordinatorOrAdmin } = require('../middleware/auth.middleware');
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

// Supervisor/Coordinator/Admin — create
// Supervisors must supply a groupId; lock-protection applies to coordinator/admin only.
router.post(
  '/',
  authenticate,
  requireSupervisorOrCoordinatorOrAdmin,
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

// Supervisor/Coordinator/Admin — delete
// Supervisors may only delete announcements they authored (enforced in controller).
router.delete(
  '/:id',
  authenticate,
  requireSupervisorOrCoordinatorOrAdmin,
  checkLocked('announcements'),
  controller.deleteAnnouncement
);

module.exports = router;
