const express = require('express');
const router = express.Router();
const controller = require('../controllers/milestones.controller');
const { authenticate, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');

// GET  /api/milestones  — authenticated; coordinators receive their course's milestones only
router.get('/', authenticate, controller.listMilestones);

// POST /api/milestones  — coordinator/admin only; course scope enforced server-side
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createMilestone);

// PATCH /api/milestones/:id — coordinator/admin only; course scope enforced server-side
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateMilestone);

// DELETE /api/milestones/:id — coordinator/admin only; also deletes linked announcement
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteMilestone);

module.exports = router;
