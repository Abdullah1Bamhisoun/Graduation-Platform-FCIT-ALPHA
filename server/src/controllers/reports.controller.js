'use strict';

/**
 * Weekly Reports Controller
 *
 * Endpoints:
 *   POST   /api/reports                  — Student submits/updates weekly report   (Trigger 2)
 *   GET    /api/reports?groupId=X        — List reports for a group
 *   PATCH  /api/reports/:id/status       — Supervisor marks report reviewed/changes_requested
 *   POST   /api/reports/:id/comments     — Supervisor/student adds a comment        (Trigger 5)
 *   GET    /api/reports/:id/comments     — List comments for a report
 */

const { supabaseAdmin } = require('../config/supabase');
const notificationService = require('../services/notification.service');
const emailService = require('../services/email.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when the Supabase error indicates the table does not exist. */
function isMissingTable(err) {
  if (!err) return false;
  return err.code === '42P01' || (err.message || '').toLowerCase().includes('does not exist');
}

async function isGroupMember(userId, groupId) {
  const { data } = await supabaseAdmin
    .from('group_members')
    .select('student_id')
    .eq('group_id', groupId)
    .eq('student_id', userId)
    .maybeSingle();
  return !!data;
}

async function isGroupSupervisor(userId, groupId) {
  const { data } = await supabaseAdmin
    .from('groups')
    .select('supervisor_id')
    .eq('id', groupId)
    .single();
  return data?.supervisor_id === userId;
}

// ─── POST /api/reports ────────────────────────────────────────────────────────

/**
 * Student submits (or updates) their group's weekly report.
 *
 * Body: { groupId, weekNumber, courseType, content }
 *
 * One report per (group_id, week_number). Upserts so re-submitting is safe.
 * Trigger 2: fires auto-announcement + notification + personal calendar for supervisor.
 */
async function submitWeeklyReport(req, res) {
  try {
    const { groupId, weekNumber, courseType, content } = req.body;

    if (!groupId || !weekNumber || !courseType || content === undefined) {
      return res.status(400).json({ error: 'groupId, weekNumber, courseType, and content are required' });
    }

    if (!['498', '499'].includes(courseType)) {
      return res.status(400).json({ error: 'courseType must be 498 or 499' });
    }

    const studentId = req.user.id;
    const isAdmin   = (req.user.roles || []).includes('admin');

    if (!isAdmin) {
      const member = await isGroupMember(studentId, groupId);
      if (!member) {
        return res.status(403).json({ error: 'Access denied: you are not a member of this group' });
      }
    }

    // Upsert — unique constraint: (group_id, week_number)
    const { data: report, error: rErr } = await supabaseAdmin
      .from('weekly_reports')
      .upsert(
        {
          group_id:    groupId,
          student_id:  studentId,
          week_number: weekNumber,
          course_type: courseType,
          content:     content ?? '',
          status:      'submitted',
          updated_at:  new Date().toISOString(),
        },
        { onConflict: 'group_id,week_number', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (rErr) {
      if (isMissingTable(rErr)) {
        return res.status(503).json({
          error: 'Weekly reports table not set up. Please run migration 012_user_calendar_events.sql.',
        });
      }
      throw rErr;
    }

    res.status(201).json({ success: true, id: report.id });

    // ── Trigger 2: notify supervisor ──────────────────────────────────────────
    ;(async () => {
      try {
        const [supervisor, courseId] = await Promise.all([
          notificationService.getSupervisorOfGroup(groupId),
          notificationService.getCourseIdFromGroup(groupId),
        ]);

        if (!supervisor) return;

        const today       = new Date().toISOString().slice(0, 10);
        const studentName = req.user.name || 'A student';

        // Send email to supervisor (fire-and-forget)
        if (supervisor.email) {
          emailService.sendWeeklyReportSubmitted(supervisor.email, {
            studentName,
            weekNumber,
            courseType,
          }).catch((e) => console.error('[reports] Failed to send weekly-report-submitted email:', e.message));
        }

        await Promise.all([
          // Announcement scoped to this group so only the group's supervisor sees it
          // in the Announcements page (requires migration 006 for group_id column).
          notificationService.createAnnouncement({
            title:       `Weekly Report #${weekNumber} Submitted`,
            content:     `${studentName} submitted Weekly Report #${weekNumber}.\nCourse: CPIS-${courseType}`,
            targetRoles: ['supervisor'],
            courseId,
            groupId,
            authorId:    req.user.id,
          }),
          notificationService.createUserNotifications([supervisor.id], {
            type:    'submission',
            title:   `New Weekly Report #${weekNumber}`,
            message: `${studentName} submitted Weekly Report #${weekNumber}.`,
            link:    '/supervisor/submissions',
          }),
        ]);
      } catch (e) {
        console.error('[reports] Trigger-2 notification error:', e.message);
      }
    })();
  } catch (error) {
    console.error('Error submitting weekly report:', error);
    res.status(500).json({ error: 'Failed to submit weekly report' });
  }
}

// ─── GET /api/reports ─────────────────────────────────────────────────────────

/**
 * List weekly reports for a group. Query: ?groupId=X
 */
async function listReports(req, res) {
  try {
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });

    const userId    = req.user.id;
    const userRoles = req.user.roles || [];
    const isAdmin   = userRoles.includes('admin');
    const activeRole = req.user.activeRole;

    if (!isAdmin && activeRole !== 'coordinator') {
      if (userRoles.includes('supervisor') || activeRole === 'supervisor') {
        const supervisor = await isGroupSupervisor(userId, groupId);
        if (!supervisor) return res.status(403).json({ error: 'Access denied: not your group' });
      } else {
        const member = await isGroupMember(userId, groupId);
        if (!member) return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('weekly_reports')
      .select('id, group_id, student_id, week_number, course_type, content, status, created_at, updated_at, student:profiles!student_id(id, name)')
      .eq('group_id', groupId)
      .order('week_number', { ascending: true });

    if (error) {
      if (isMissingTable(error)) return res.json([]);
      throw error;
    }

    res.json((data || []).map((r) => ({
      id:          r.id,
      groupId:     r.group_id,
      studentId:   r.student_id,
      studentName: r.student?.name ?? '',
      weekNumber:  r.week_number,
      courseType:  r.course_type,
      content:     r.content,
      status:      r.status,
      createdAt:   r.created_at,
      updatedAt:   r.updated_at,
    })));
  } catch (error) {
    console.error('Error listing weekly reports:', error);
    res.status(500).json({ error: 'Failed to fetch weekly reports' });
  }
}

// ─── PATCH /api/reports/:id/status ───────────────────────────────────────────

/**
 * Supervisor marks a report reviewed or requests changes.
 * Body: { status: 'reviewed' | 'changes_requested' }
 */
async function updateReportStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['reviewed', 'changes_requested'].includes(status)) {
      return res.status(400).json({ error: 'status must be reviewed or changes_requested' });
    }

    const { data: report, error: rErr } = await supabaseAdmin
      .from('weekly_reports')
      .select('id, group_id, week_number, course_type')
      .eq('id', id)
      .single();

    if (rErr || !report) return res.status(404).json({ error: 'Report not found' });

    const isAdmin = (req.user.roles || []).includes('admin');
    if (!isAdmin) {
      const isSup = await isGroupSupervisor(req.user.id, report.group_id);
      if (!isSup) return res.status(403).json({ error: 'Access denied: not the supervisor of this group' });
    }

    const { error: uErr } = await supabaseAdmin
      .from('weekly_reports')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (uErr) throw uErr;

    res.json({ success: true });

    // ── Notify group students of status change ────────────────────────────────
    ;(async () => {
      try {
        const members = await notificationService.getGroupMembers(report.group_id);
        if (members.length === 0) return;

        const supervisorName = req.user.name || 'Your supervisor';
        const studentIds     = members.map((m) => m.id);
        const studentEmails  = members.map((m) => m.email).filter(Boolean);
        const statusLabel    = status === 'reviewed' ? 'Reviewed' : 'Changes Requested';

        emailService.sendWeeklyReportStatusUpdate(studentEmails, {
          supervisorName,
          weekNumber:  report.week_number,
          courseType:  report.course_type,
          status,
        }).catch((e) => console.error('[reports] Failed to send weekly-report-status-update email:', e.message));

        await notificationService.createUserNotifications(studentIds, {
          type:    'feedback',
          title:   `Weekly Report #${report.week_number} — ${statusLabel}`,
          message: `${supervisorName} marked your Weekly Report #${report.week_number} as "${statusLabel}".`,
          link:    '/student/weekly-reports',
        });
      } catch (e) {
        console.error('[reports] updateReportStatus notification error:', e.message);
      }
    })();
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'Failed to update report status' });
  }
}

// ─── POST /api/reports/:id/comments ──────────────────────────────────────────

/**
 * Add a comment to a weekly report.
 * Body: { content }
 *
 * Trigger 5: when the author is a supervisor, fires notifications to all group students.
 */
async function addReportComment(req, res) {
  try {
    const { id: reportId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const { data: report, error: rErr } = await supabaseAdmin
      .from('weekly_reports')
      .select('id, group_id, week_number, course_type')
      .eq('id', reportId)
      .single();

    if (rErr || !report) return res.status(404).json({ error: 'Report not found' });

    const userId    = req.user.id;
    const userRoles = req.user.roles || [];
    const activeRole = req.user.activeRole;
    const isAdmin   = userRoles.includes('admin');

    let callerRole = null;
    if (isAdmin) {
      callerRole = 'admin';
    } else if (activeRole === 'coordinator') {
      callerRole = 'coordinator';
    } else if (userRoles.includes('supervisor') || activeRole === 'supervisor') {
      const isSup = await isGroupSupervisor(userId, report.group_id);
      if (isSup) callerRole = 'supervisor';
    } else {
      const member = await isGroupMember(userId, report.group_id);
      if (member) callerRole = 'student';
    }

    if (!callerRole) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { data: comment, error: cErr } = await supabaseAdmin
      .from('weekly_report_comments')
      .insert({
        report_id:   reportId,
        author_id:   userId,
        author_role: callerRole,
        content:     content.trim(),
      })
      .select('id')
      .single();

    if (cErr) {
      if (isMissingTable(cErr)) {
        return res.status(503).json({ error: 'Weekly report comments table not set up. Run migration 012.' });
      }
      throw cErr;
    }

    res.status(201).json({ success: true, id: comment.id });

    // ── Trigger 5: supervisor replied → notify group students ─────────────────
    if (callerRole === 'supervisor' || callerRole === 'admin') {
      ;(async () => {
        try {
          const [members, courseId] = await Promise.all([
            notificationService.getGroupMembers(report.group_id),
            notificationService.getCourseIdFromGroup(report.group_id),
          ]);

          const studentIds    = members.map((m) => m.id);
          const studentEmails = members.map((m) => m.email).filter(Boolean);
          if (studentIds.length === 0) return;

          const supervisorName = req.user.name || 'Your supervisor';

          // Email every student in the group (fire-and-forget)
          emailService.sendWeeklyReportFeedback(studentEmails, {
            supervisorName,
            weekNumber:     report.week_number,
            courseType:     report.course_type,
            commentPreview: content.trim(),
          }).catch((e) => console.error('[reports] Failed to send weekly-report-feedback email:', e.message));

          await Promise.all([
            notificationService.createUserNotifications(studentIds, {
              type:    'feedback',
              title:   `Feedback on Weekly Report #${report.week_number}`,
              message: `${supervisorName} added feedback to your Weekly Report #${report.week_number}.`,
              link:    '/student/weekly-reports',
            }),
            notificationService.createAnnouncement({
              title:       `Supervisor Feedback on Weekly Report #${report.week_number}`,
              content:     `Your supervisor added feedback to Weekly Report #${report.week_number}. Please review it.`,
              targetRoles: ['student'],
              courseId,
              groupId:     report.group_id,
              authorId:    userId,
            }),
          ]);
        } catch (e) {
          console.error('[reports] Trigger-5 notification error:', e.message);
        }
      })();
    }
  } catch (error) {
    console.error('Error adding report comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
}

// ─── GET /api/reports/:id/comments ───────────────────────────────────────────

/**
 * List comments for a weekly report.
 */
async function listReportComments(req, res) {
  try {
    const { id: reportId } = req.params;

    const { data: report, error: rErr } = await supabaseAdmin
      .from('weekly_reports')
      .select('id, group_id')
      .eq('id', reportId)
      .single();

    if (rErr || !report) return res.status(404).json({ error: 'Report not found' });

    const userId    = req.user.id;
    const userRoles = req.user.roles || [];
    const activeRole = req.user.activeRole;
    const isAdmin   = userRoles.includes('admin');

    if (!isAdmin && activeRole !== 'coordinator') {
      const isSup    = (userRoles.includes('supervisor') || activeRole === 'supervisor')
                       && await isGroupSupervisor(userId, report.group_id);
      const isMember = !isSup && await isGroupMember(userId, report.group_id);
      if (!isSup && !isMember) return res.status(403).json({ error: 'Access denied' });
    }

    const { data: comments, error: cErr } = await supabaseAdmin
      .from('weekly_report_comments')
      .select('id, report_id, author_id, author_role, content, created_at, author:profiles!author_id(id, name)')
      .eq('report_id', reportId)
      .order('created_at', { ascending: true });

    if (cErr) {
      if (isMissingTable(cErr)) return res.json([]);
      throw cErr;
    }

    res.json((comments || []).map((c) => ({
      id:         c.id,
      reportId:   c.report_id,
      authorId:   c.author_id,
      authorName: c.author?.name ?? 'Unknown',
      authorRole: c.author_role,
      content:    c.content,
      createdAt:  c.created_at,
    })));
  } catch (error) {
    console.error('Error listing report comments:', error);
    res.status(500).json({ error: 'Failed to fetch report comments' });
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  submitWeeklyReport,
  listReports,
  updateReportStatus,
  addReportComment,
  listReportComments,
};
