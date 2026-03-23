const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/milestones.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createMilestoneSchema, updateMilestoneSchema } = require('../schemas/domain.schemas');

// GET /api/milestones — authenticated; coordinators receive their course only
router.get('/', authenticate, controller.listMilestones);

// POST /api/milestones — coordinator/admin; validated + course scope enforced server-side
router.post(
  '/',
  authenticate,
  requireCoordinatorOrAdmin,
  validate(createMilestoneSchema),
  controller.createMilestone
);

// PATCH /api/milestones/:id — coordinator/admin; validated + course scope enforced server-side
router.patch(
  '/:id',
  authenticate,
  requireCoordinatorOrAdmin,
  validate(updateMilestoneSchema),
  controller.updateMilestone
);

// DELETE /api/milestones/:id — coordinator/admin; also deletes linked announcement
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteMilestone);

module.exports = router;
