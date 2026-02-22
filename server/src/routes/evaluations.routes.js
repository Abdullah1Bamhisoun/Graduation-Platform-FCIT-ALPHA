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

module.exports = router;
