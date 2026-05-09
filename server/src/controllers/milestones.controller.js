const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');
const { normalizeCourseCode } = require('../utils/helpers');
const notificationService = require('../services/notification.service');
const { cacheGet, cacheSet, cacheDelPattern, TTL } = require('../utils/cache');

/**
 * GET /api/milestones
 * Authenticated — returns milestones.
 *   Coordinators: only their assigned course.
 *   Admins: all milestones (optionally filtered by ?course_id).
 */
async function listMilestones(req, res) {
  try {
    const isAdmin = req.user.roles.includes('admin');
    const isCoordinator = req.user.activeRole === 'coordinator';

    let courseId = null;

    if (isCoordinator && !isAdmin) {
      courseId = req.user.coordinatorCourseId;
      if (!courseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
    } else if (req.query.course_id) {
      courseId = req.query.course_id;
    }

    const ck = `milestones:${courseId ?? 'all'}`;
    const cached = await cacheGet(ck);
    if (cached) return res.json(cached);

    let query = supabaseAdmin
      .from('milestones')
      .select('*, course:courses!course_id(id, code, name), rubric_criteria(id, name, max_score, sort_order), grading_criterion:grading_rubric_criteria!grading_criterion_id(id, criterion_key, criterion_name, max_raw_score)')
      .order('due_date');

    if (courseId) {
      query = query.eq('course_id', courseId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const payload = (data || []).map((m) => ({
      id:                       m.id,
      name:                     m.name,
      type:                     m.type,
      courseId:                 m.course_id,
      courseCode:               normalizeCourseCode(m.course?.code ?? ''),
      openDate:                 m.open_date,
      dueDate:                  m.due_date,
      visible:                  m.visible ?? true,
      allowLateSubmission:      m.allow_late_submission ?? false,
      requireJustification:     m.require_justification ?? false,
      description:              m.description ?? '',
      gradingCriterionId:       m.grading_criterion?.id ?? null,
      gradingCriterionKey:      m.grading_criterion?.criterion_key ?? null,
      gradingCriterionName:     m.grading_criterion?.criterion_name ?? null,
      gradingCriterionMax:      m.grading_criterion?.max_raw_score ?? null,
      includeInCommitteeEval:   m.include_in_committee_eval ?? false,
      allowedFileType:          m.allowed_file_type ?? undefined,
    }));

    await cacheSet(ck, payload, TTL.SHORT);
    res.json(payload);
  } catch (error) {
    console.error('Error listing milestones:', error);
    res.status(500).json({ error: 'Failed to fetch milestones' });
  }
}

/**
 * POST /api/milestones
 * Coordinator/Admin — create a milestone and auto-create an announcement.
 * Coordinators may only create milestones for their assigned course.
 */
async function createMilestone(req, res) {
  try {
    const {
      name, type, courseId, openDate, dueDate,
      visible, allowLateSubmission, requireJustification, description,
      gradingCriterionId, includeInCommitteeEval, allowedFileType,
    } = req.body;

    if (!name || !courseId || !openDate || !dueDate) {
      return res.status(400).json({ error: 'name, courseId, openDate, and dueDate are required' });
    }

    // Enforce course scope for coordinators (admins bypass)
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin) {
      if (!req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'No course assigned to your coordinator account' });
      }
      if (courseId !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only create milestones for your assigned course' });
      }
    }

    // Fetch course info for announcement
    const { data: course, error: cErr } = await supabaseAdmin
      .from('courses')
      .select('id, code, name')
      .eq('id', courseId)
      .single();

    if (cErr || !course) {
      return res.status(400).json({ error: 'Invalid courseId — course not found' });
    }

    // Create the milestone
    const { data: milestone, error: mErr } = await supabaseAdmin
      .from('milestones')
      .insert({
        name,
        type:                  type ?? 'chapter',
        course_id:             courseId,
        open_date:             openDate,
        due_date:              dueDate,
        visible:                     visible ?? true,
        allow_late_submission:       allowLateSubmission ?? false,
        require_justification:       requireJustification ?? false,
        description:                 description ?? null,
        grading_criterion_id:        gradingCriterionId ?? null,
        include_in_committee_eval:   includeInCommitteeEval ?? false,
        allowed_file_type:           allowedFileType ?? null,
      })
      .select('id')
      .single();

    if (mErr) throw mErr;

    // Auto-create announcement for students
    const dueDateFormatted = new Date(dueDate).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
    const openDateFormatted = new Date(openDate).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });

    const courseLabel = [normalizeCourseCode(course.code), course.name].filter(Boolean).join(' — ');
    const announcementContent = [
      description || `A new chapter submission has been added for ${courseLabel}.`,
      `Course: ${courseLabel}`,
      '',
      `Submission opens: ${openDateFormatted}`,
      `Submission deadline: ${dueDateFormatted}`,
    ].join('\n');

    // Try inserting with course_id (post-migration 005). Fall back without it (pre-migration).
    let aRes = await supabaseAdmin.from('announcements').insert({
      title:        `New Milestone: ${name}`,
      content:      announcementContent,
      author_id:    req.user.id,
      course_id:    courseId,
      target_roles: ['student'],
      published_at: new Date().toISOString(),
      expires_at:   dueDate,
    });
    if (aRes.error) {
      aRes = await supabaseAdmin.from('announcements').insert({
        title:        `New Milestone: ${name}`,
        content:      announcementContent,
        author_id:    req.user.id,
        target_roles: ['student'],
        published_at: new Date().toISOString(),
        expires_at:   dueDate,
      });
    }
    if (aRes.error) {
      // Best-effort — do not fail the whole request if announcement creation fails
      console.warn('Auto-announcement creation failed (non-fatal):', aRes.error.message);
    }

    // Send email to students in this course (best-effort, non-blocking)
    ;(async () => {
      try {
        const { data: groups } = await supabaseAdmin
          .from('groups').select('id').eq('course_id', courseId);
        const groupIds = (groups || []).map((g) => g.id);
        if (groupIds.length === 0) return;

        const { data: members } = await supabaseAdmin
          .from('group_members').select('student_id').in('group_id', groupIds);
        const studentIds = (members || []).map((m) => m.student_id);
        if (studentIds.length === 0) return;

        const { data: profiles } = await supabaseAdmin
          .from('profiles').select('email').in('id', studentIds);
        const emails = (profiles || []).map((p) => p.email).filter(Boolean);
        if (emails.length === 0) return;

        await emailService.sendMilestoneCreated(emails, {
          milestoneName: name,
          courseName: course.code,
          openDate,
          dueDate,
          description: description || '',
        });
      } catch (e) {
        console.error('[milestones] Failed to send milestone emails:', e);
      }
    })();

    await cacheDelPattern('milestones:*');
    res.status(201).json({ success: true, id: milestone.id });

    // ── Trigger 6: supervisor announcement + calendar event ───────────────────
    ;(async () => {
      try {
        await Promise.all([
          notificationService.createAnnouncement({
            title:       `New Milestone Added: ${name}`,
            content:     `Coordinator created milestone "${name}" (type: ${type ?? 'chapter'}).\nCourse: ${courseLabel}\nOpens: ${openDateFormatted}\nDue: ${dueDateFormatted}${description ? `\n\n${description}` : ''}`,
            targetRoles: ['supervisor'],
            courseId,
            authorId:    req.user.id,
            expiresAt:   dueDate,
          }),
          notificationService.createCalendarEvent({
            title:    `Milestone Due: ${name}`,
            date:     dueDate.slice(0, 10),
            type:     'deadline',
            courseId,
          }),
        ]);
      } catch (e) {
        console.error('[milestones] Trigger-6 notification error:', e.message);
      }
    })();
  } catch (error) {
    console.error('Error creating milestone:', error);
    res.status(500).json({ error: 'Failed to create milestone' });
  }
}

/**
 * PATCH /api/milestones/:id
 * Coordinator/Admin — update a milestone.
 * Coordinators may only update milestones belonging to their assigned course.
 */
async function updateMilestone(req, res) {
  try {
    const { id } = req.params;

    // Verify milestone exists and belongs to the coordinator's course
    const { data: existing, error: eErr } = await supabaseAdmin
      .from('milestones')
      .select('id, course_id')
      .eq('id', id)
      .single();

    if (eErr || !existing) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin) {
      if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only update milestones for your assigned course' });
      }
    }

    const updates = req.body;
    const dbUpdates = {};
    if (updates.name                 !== undefined) dbUpdates.name                  = updates.name;
    if (updates.openDate             !== undefined) dbUpdates.open_date             = updates.openDate;
    // Accept both closeDate (config form) and dueDate
    if (updates.closeDate            !== undefined) dbUpdates.due_date              = updates.closeDate;
    if (updates.dueDate              !== undefined) dbUpdates.due_date              = updates.dueDate;
    if (updates.visible              !== undefined) dbUpdates.visible               = updates.visible;
    if (updates.allowLateSubmission  !== undefined) dbUpdates.allow_late_submission = updates.allowLateSubmission;
    if (updates.requireJustification !== undefined) dbUpdates.require_justification = updates.requireJustification;
    if (updates.description          !== undefined) dbUpdates.description           = updates.description;
    // Allow null to explicitly unlink a criterion
    if ('gradingCriterionId' in updates) dbUpdates.grading_criterion_id = updates.gradingCriterionId ?? null;
    if ('includeInCommitteeEval' in updates) dbUpdates.include_in_committee_eval = updates.includeInCommitteeEval ?? false;
    if ('allowedFileType' in updates) dbUpdates.allowed_file_type = updates.allowedFileType ?? null;

    const { error: uErr } = await supabaseAdmin
      .from('milestones')
      .update(dbUpdates)
      .eq('id', id);

    if (uErr) throw uErr;

    await cacheDelPattern('milestones:*');

    // Notify students synchronously so errors surface to the caller.
    let notified = false;
    if (req.body.notify) {
      try {
        const { data: m, error: mErr } = await supabaseAdmin
          .from('milestones')
          .select('name, course_id, open_date, due_date')
          .eq('id', id)
          .maybeSingle();

        if (!m) throw new Error(`Milestone re-fetch failed: ${mErr?.message ?? 'row not returned'}`);

        {
          const { data: course } = await supabaseAdmin
            .from('courses').select('code, name').eq('id', m.course_id).single();

          const courseCode  = normalizeCourseCode(course?.code ?? '');
          const courseLabel = [courseCode, course?.name].filter(Boolean).join(' — ');
          const dueDateFmt  = new Date(m.due_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
          const openDateFmt = new Date(m.open_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

          const content = [
            `The deadline for "${m.name}" has been updated.`,
            `Course: ${courseLabel}`,
            '',
            `Submission opens: ${openDateFmt}`,
            `New deadline: ${dueDateFmt}`,
          ].join('\n');

          // 1. Course-scoped announcement visible on the Announcements page
          const ann = await notificationService.createAnnouncement({
            title:       `Deadline Updated: ${m.name}`,
            content,
            targetRoles: ['student'],
            courseId:    m.course_id,
            authorId:    req.user.id,
            expiresAt:   m.due_date,
          });
          if (!ann) throw new Error('createAnnouncement returned null — check DB/migration logs');

          // 2. Resolve all students in this course
          const { data: groups } = await supabaseAdmin
            .from('groups').select('id').eq('course_id', m.course_id);
          const groupIds = (groups || []).map((g) => g.id);

          if (groupIds.length > 0) {
            const { data: members } = await supabaseAdmin
              .from('group_members').select('student_id').in('group_id', groupIds);
            const studentIds = [...new Set((members || []).map((mb) => mb.student_id))];

            if (studentIds.length > 0) {
              // 3. Per-user bell notifications
              await notificationService.createUserNotifications(studentIds, {
                type:    'announcement',
                title:   `Deadline Updated: ${m.name}`,
                message: `New deadline: ${dueDateFmt}`,
                link:    '/student/milestones',
              });

              // 4. Emails (best-effort, non-blocking)
              const { data: profiles } = await supabaseAdmin
                .from('profiles').select('email').in('id', studentIds);
              const emails = (profiles || []).map((p) => p.email).filter(Boolean);
              if (emails.length > 0) {
                emailService.sendMilestoneDeadlineUpdated(emails, {
                  milestoneName: m.name,
                  courseName:    courseCode || courseLabel,
                  openDate:      m.open_date,
                  dueDate:       m.due_date,
                }).catch((e) => console.error('[milestones] email send error:', e.message));
              }
            }
          }

          notified = true;
        }
      } catch (notifyErr) {
        console.error('[milestones] notify-on-update error:', notifyErr.message);
        return res.json({ success: true, notified: false, notifyError: notifyErr.message });
      }
    }

    res.json({ success: true, notified });
  } catch (error) {
    console.error('Error updating milestone:', error);
    res.status(500).json({ error: 'Failed to update milestone' });
  }
}

/**
 * DELETE /api/milestones/:id
 * Coordinator/Admin — delete a milestone and its linked auto-announcement.
 */
async function deleteMilestone(req, res) {
  try {
    const { id } = req.params;

    const { data: existing, error: eErr } = await supabaseAdmin
      .from('milestones')
      .select('id, course_id')
      .eq('id', id)
      .single();

    if (eErr || !existing) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin) {
      if (existing.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'You can only delete milestones for your assigned course' });
      }
    }

    // Delete linked auto-announcement (identified by [ref:milestone:ID] in content)
    const refTag = `[ref:milestone:${id}]`;
    const { error: aErr } = await supabaseAdmin
      .from('announcements')
      .delete()
      .like('content', `%${refTag}%`);

    if (aErr) {
      console.warn('Auto-announcement delete failed (best-effort):', aErr.message);
    }

    // Delete the milestone
    const { error: dErr } = await supabaseAdmin
      .from('milestones')
      .delete()
      .eq('id', id);

    if (dErr) throw dErr;

    await cacheDelPattern('milestones:*');
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    res.status(500).json({ error: 'Failed to delete milestone' });
  }
}

module.exports = { listMilestones, createMilestone, updateMilestone, deleteMilestone };
