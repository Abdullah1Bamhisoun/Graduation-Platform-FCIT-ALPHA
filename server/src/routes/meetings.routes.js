const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/meetings.controller');
const { authenticate, requireRole, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createMeetingSchema, updateMeetingSchema } = require('../schemas/domain.schemas');
const { supabaseAdmin } = require('../config/supabase');

const canManageMeetings = requireRole(['coordinator', 'supervisor', 'admin']);
const canViewMeetings   = requireRole(['coordinator', 'supervisor', 'student', 'admin']);

/**
 * GET /api/meetings/coordinator-groups
 * Returns a lightweight list of groups scoped to the coordinator's course.
 * Used to populate the "Group" dropdown when scheduling a meeting.
 */
router.get('/coordinator-groups', authenticate, requireCoordinatorOrAdmin, async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('groups')
      .select('id, project_name, group_code, group_number')
      .order('group_number', { ascending: true });

    // Scope to coordinator's course if set
    if (req.user.coordinatorCourseId) {
      query = query.eq('course_id', req.user.coordinatorCourseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const groups = (data || []).map((g) => ({
      id:   g.id,
      name: g.project_name || g.group_code || `Group ${g.group_number}`,
    }));
    return res.json(groups);
  } catch (err) {
    console.error('[meetings/coordinator-groups]', err.message);
    return res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// GET  /api/meetings — role-filtered list
router.get('/',    authenticate, canViewMeetings,   controller.listMeetings);

// GET  /api/meetings/:id — single meeting
router.get('/:id', authenticate, canViewMeetings,   controller.getMeeting);

// POST /api/meetings — create (coordinator or supervisor)
router.post(
  '/',
  authenticate,
  canManageMeetings,
  validate(createMeetingSchema),
  controller.createMeeting
);

// PATCH /api/meetings/:id — update (creator only — enforced in controller)
router.patch(
  '/:id',
  authenticate,
  canManageMeetings,
  validate(updateMeetingSchema),
  controller.updateMeeting
);

// DELETE /api/meetings/:id — cancel (creator only — enforced in controller)
router.delete('/:id', authenticate, canManageMeetings, controller.deleteMeeting);

// POST /api/meetings/:id/resend-invitation — resend invitation email
router.post('/:id/resend-invitation', authenticate, canManageMeetings, controller.resendInvitation);

// POST /api/meetings/process-reminders — internal cron endpoint
// Protected by a simple secret header so it can be called by a scheduler without a user token
router.post('/process-reminders', (req, res, next) => {
  const secret = req.headers['x-cron-secret'];
  if (secret && secret === process.env.CRON_SECRET) return next();
  // Also allow authenticated coordinators/admins to trigger manually
  authenticate(req, res, () => {
    if (!req.user || !['coordinator', 'admin'].some((r) => req.user.roles.includes(r))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  });
}, controller.processReminders);

module.exports = router;
