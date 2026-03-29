const express = require('express');
const router = express.Router();
const controller = require('../controllers/evaluations.controller');
const { authenticate, requireSupervisorOrAdmin } = require('../middleware/auth.middleware');

/**
 * GET /api/evaluations/groups
 * Supervisor: returns groups they can evaluate (excludes their own supervised group).
 * If evaluation_assignments exist, only officially assigned groups are returned.
 */
router.get('/groups', authenticate, requireSupervisorOrAdmin, controller.getGroupsForEvaluation);

/**
 * POST /api/evaluations/scores
 * Supervisor or committee member: submit rubric scores for a group.
 * Fires Trigger 4: auto-announcement + per-student notifications on save.
 */
router.post('/scores', authenticate, requireSupervisorOrAdmin, controller.saveScores);

module.exports = router;
