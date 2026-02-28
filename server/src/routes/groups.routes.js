const express = require('express');
const router = express.Router();
const controller = require('../controllers/groups.controller');
const { authenticate, requireAdmin, requireCoordinatorOrAdmin, requireSupervisorOrAdmin } = require('../middleware/auth.middleware');
const { checkLocked } = require('../middleware/lock.middleware');

// Public — for registration page group selection
router.get('/available', controller.getAvailableGroups);

// ── Supervisor routes (must come before /:id wildcards) ──────────────────────

/**
 * GET /api/groups/supervisor-grades
 * Returns grade data for all groups assigned to the requesting supervisor.
 * Backend-enforced: only supervisor_id-matched groups are returned.
 * Grading scheme (components/weights) is fetched dynamically from grading_components —
 * never hardcoded — ensuring the Coordinator's centralized scheme is always used.
 */
router.get('/supervisor-grades', authenticate, requireSupervisorOrAdmin, controller.getSupervisorGroupsWithGrades);

/**
 * PATCH /api/groups/:id/project-status
 * Supervisor marks a group as IP (In Progress) or restores it to Normal.
 * Backend validates supervisor ownership before allowing the update.
 * Action is recorded in audit_log.
 */
router.patch('/:id/project-status', authenticate, requireSupervisorOrAdmin, controller.markGroupAsIP);

/**
 * POST /api/groups/:id/supervisor-evaluation
 * Supervisor submits rubric-based evaluation scores for each student in a group.
 * Backend validates supervisor ownership, student membership, criterion keys,
 * and score ranges (1–5). Normalized score is calculated server-side and synced
 * to supervisor_assessments. Grading scheme is read dynamically from
 * grading_rubric_criteria + grading_components — never hardcoded.
 */
router.post('/:id/supervisor-evaluation', authenticate, requireSupervisorOrAdmin, controller.submitSupervisorEvaluation);

// ── Coordinator / Admin routes ────────────────────────────────────────────────

router.get('/', authenticate, requireCoordinatorOrAdmin, controller.getAllGroups);
router.post('/', authenticate, requireCoordinatorOrAdmin, controller.createGroup);
router.patch('/:id', authenticate, requireCoordinatorOrAdmin, controller.updateGroup);
router.delete('/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteGroup);
router.post('/:id/assign-supervisor', authenticate, requireCoordinatorOrAdmin, controller.assignSupervisor);
router.patch('/:id/status', authenticate, requireCoordinatorOrAdmin, controller.updateGroupStatus);

module.exports = router;
