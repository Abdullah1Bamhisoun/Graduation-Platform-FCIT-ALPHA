const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/meetings.controller');
const { authenticate, requireRole, requireCoordinatorOrAdmin } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { createMeetingSchema, updateMeetingSchema } = require('../schemas/domain.schemas');
const { supabaseAdmin } = require('../config/supabase');
const { queueDiscussionNotificationEmail } = require('../services/queue.service');
const { APP_URL } = require('../config/env');

// Track the last time an email was sent per group — reset on server restart
const lastDiscussionEmailAt = new Map(); // group_id → Date
const DISCUSSION_EMAIL_COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours

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

/**
 * POST /api/meetings/discussions/notify
 * Sends an email to all members of a group when a discussion message is posted.
 * Scoped: supervisor → only their own groups; coordinator → only their course groups.
 */
router.post('/discussions/notify', authenticate, requireRole(['supervisor', 'coordinator', 'admin']), async (req, res) => {
  try {
    const { group_id, sender_name, sender_role, message } = req.body;
    if (!group_id || !message) {
      return res.status(400).json({ error: 'group_id and message are required' });
    }

    // Verify the caller has access to this group
    if (req.user.activeRole === 'supervisor') {
      const { data: group } = await supabaseAdmin
        .from('groups').select('supervisor_id').eq('id', group_id).single();
      if (!group || group.supervisor_id !== req.user.id) {
        return res.status(403).json({ error: 'You are not the supervisor of this group' });
      }
    }

    // Fetch group display name
    const { data: groupRow } = await supabaseAdmin
      .from('groups').select('project_name, group_code, group_number').eq('id', group_id).single();
    const groupName = groupRow
      ? (groupRow.project_name || groupRow.group_code || `Group ${groupRow.group_number}`)
      : 'Your Group';

    // Collect all member IDs (students + supervisor)
    const { data: members } = await supabaseAdmin
      .from('group_members').select('student_id').eq('group_id', group_id);
    const { data: groupSup } = await supabaseAdmin
      .from('groups').select('supervisor_id').eq('id', group_id).single();

    const userIds = [
      ...(members || []).map((m) => m.student_id),
      groupSup?.supervisor_id,
    ].filter(Boolean).filter((id) => id !== req.user.id); // don't email the sender

    if (userIds.length === 0) return res.json({ sent: 0 });

    const { data: profiles } = await supabaseAdmin
      .from('profiles').select('email').in('id', userIds);
    const emails = (profiles || []).map((p) => p.email).filter(Boolean);

    const now = Date.now();
    const lastSent = lastDiscussionEmailAt.get(group_id);
    const cooledDown = !lastSent || (now - lastSent) >= DISCUSSION_EMAIL_COOLDOWN_MS;

    if (emails.length > 0 && cooledDown) {
      lastDiscussionEmailAt.set(group_id, now);
      await queueDiscussionNotificationEmail(emails, {
        senderName: sender_name || req.user.name || 'Supervisor',
        senderRole: sender_role || req.user.activeRole,
        groupName,
        message,
        appUrl: APP_URL ?? '',
      });
    }

    return res.json({ sent: cooledDown ? emails.length : 0, cooldown: !cooledDown });
  } catch (err) {
    console.error('[discussions/notify]', err.message);
    return res.status(500).json({ error: 'Failed to send discussion notification' });
  }
});

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
