const express  = require('express');
const router   = express.Router();
const controller = require('../controllers/groups.controller');
const {
  authenticate,
  requireAdmin,
  requireCoordinatorOrAdmin,
  requireSupervisorOrAdmin,
  validateCoordinatorCourseType,
} = require('../middleware/auth.middleware');
const { checkLocked } = require('../middleware/lock.middleware');
const { validate } = require('../middleware/validate.middleware');
const { paginate } = require('../middleware/paginate.middleware');
const {
  supervisorEvaluationSchema,
  coordinatorEvaluationSchema,
} = require('../schemas/domain.schemas');

// Public — for registration page group selection (unauthenticated)
router.get('/available', controller.getAvailableGroups);

// ── Supervisor routes ─────────────────────────────────────────────────────────

/**
 * GET /api/groups/mine
 * Lightweight list of groups assigned to the requesting supervisor.
 * Returns [ { id, name, group_code } ] — used by the Meeting dialog.
 */
router.get(
  '/mine',
  authenticate,
  requireSupervisorOrAdmin,
  async (req, res) => {
    try {
      const { supabaseAdmin } = require('../config/supabase');
      const { data, error } = await supabaseAdmin
        .from('groups')
        .select('id, project_name, group_code, group_number')
        .eq('supervisor_id', req.user.id)
        .order('group_number', { ascending: true });
      if (error) throw error;
      const groups = (data || []).map((g) => ({
        id:   g.id,
        name: g.project_name || g.group_code || `Group ${g.group_number}`,
      }));
      return res.json(groups);
    } catch (err) {
      console.error('[groups/mine]', err.message);
      return res.status(500).json({ error: 'Failed to fetch groups' });
    }
  }
);

/**
 * GET /api/groups/supervisor-grades
 * Returns grade data for all groups assigned to the requesting supervisor.
 */
router.get(
  '/supervisor-grades',
  authenticate,
  requireSupervisorOrAdmin,
  controller.getSupervisorGroupsWithGrades
);

/**
 * PATCH /api/groups/:id/project-status
 * Supervisor marks a group as IP (In Progress) or restores it to Normal.
 */
router.patch(
  '/:id/project-status',
  authenticate,
  requireSupervisorOrAdmin,
  controller.markGroupAsIP
);

/**
 * POST /api/groups/:id/supervisor-evaluation
 * Supervisor submits rubric-based evaluation scores.
 * Validated: scores array with criterion keys + 0–5 range.
 */
router.post(
  '/:id/supervisor-evaluation',
  authenticate,
  requireSupervisorOrAdmin,
  validate(supervisorEvaluationSchema),
  controller.submitSupervisorEvaluation
);

// ── Coordinator routes ────────────────────────────────────────────────────────

/**
 * GET /api/groups/coordinator-grades?courseType=498
 * Returns all groups in coordinator's assigned course with grade data.
 */
router.get(
  '/coordinator-grades',
  authenticate,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
  controller.getGroupsWithCoordinatorGrades
);

/**
 * POST /api/groups/:id/coordinator-evaluation
 * Coordinator submits rubric-based evaluation scores for a group.
 * Validated: scores array with criterion keys + 0–5 range.
 */
router.post(
  '/:id/coordinator-evaluation',
  authenticate,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
  validate(coordinatorEvaluationSchema),
  controller.submitCoordinatorEvaluation
);

/**
 * GET /api/groups/:id/coordinator-evaluation?courseType=498
 * Fetches existing Coordinator Evaluation for a group (for modal pre-fill).
 */
router.get(
  '/:id/coordinator-evaluation',
  authenticate,
  requireCoordinatorOrAdmin,
  validateCoordinatorCourseType,
  controller.getCoordinatorEvaluation
);

// ── Coordinator / Admin CRUD ──────────────────────────────────────────────────

router.get(
  '/',
  authenticate,
  requireCoordinatorOrAdmin,
  paginate({ defaultLimit: 200, maxLimit: 200 }),
  controller.getAllGroups
);
router.get(    '/:id', authenticate, requireCoordinatorOrAdmin, controller.getGroupById);
router.post(   '/',     authenticate, requireCoordinatorOrAdmin, controller.createGroup);
router.patch(  '/:id', authenticate, requireCoordinatorOrAdmin, controller.updateGroup);
router.delete( '/:id', authenticate, requireCoordinatorOrAdmin, controller.deleteGroup);
router.post(   '/:id/assign-supervisor', authenticate, requireCoordinatorOrAdmin, controller.assignSupervisor);
router.patch(  '/:id/status',           authenticate, requireCoordinatorOrAdmin, controller.updateGroupStatus);

module.exports = router;
