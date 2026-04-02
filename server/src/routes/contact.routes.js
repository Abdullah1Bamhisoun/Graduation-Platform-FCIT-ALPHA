const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/contact.controller');
const {
  authenticate,
  requireAdmin,
  requireCoordinatorOrAdmin,
} = require('../middleware/auth.middleware');

// ── Coordinator contacts ──────────────────────────────────────────────────────

// GET /api/contact/coordinators — all authenticated users can read
router.get('/coordinators', authenticate, controller.listCoordinatorContacts);

// PUT /api/contact/coordinators/:courseId — coordinator (own course) or admin
router.put(
  '/coordinators/:courseId',
  authenticate,
  requireCoordinatorOrAdmin,
  controller.upsertCoordinatorContact
);

// DELETE /api/contact/coordinators/:courseId — admin only
router.delete(
  '/coordinators/:courseId',
  authenticate,
  requireAdmin,
  controller.deleteCoordinatorContact
);

// ── Support team info ─────────────────────────────────────────────────────────

// GET /api/contact/support — all authenticated users can read
router.get('/support', authenticate, controller.getSupportInfo);

// PUT /api/contact/support — admin only
router.put('/support', authenticate, requireAdmin, controller.upsertSupportInfo);

module.exports = router;
