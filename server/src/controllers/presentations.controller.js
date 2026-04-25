const { supabaseAdmin } = require('../config/supabase');
const emailService = require('../services/email.service');
const notificationService = require('../services/notification.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true when a Supabase/PostgREST error is caused by a missing column (42703).
 * Used for graceful fallback when the scheduled_at / calendar_event_id migration
 * has not yet been applied.
 * NOTE: deliberately does NOT match 42P01 (relation/table does not exist) —
 *       use isMissingTable() for that.
 */
function isMissingColumn(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.details || '');
  return err.code === '42703' || (
    msg.toLowerCase().includes('does not exist') &&
    !msg.toLowerCase().includes('relation') &&
    !msg.toLowerCase().includes('table')
  );
}

/**
 * Returns true when a Supabase/PostgREST error is caused by a missing table (42P01).
 */
function isMissingTable(err) {
  if (!err) return false;
  const msg = (err.message || '') + (err.details || '');
  return err.code === '42P01' || (
    msg.toLowerCase().includes('relation') && msg.toLowerCase().includes('does not exist')
  );
}

/**
 * Format a Date to "Monday, 15 May 2026 – 10:00 AM" (server locale).
 */
function formatPresentationDateTime(date) {
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return `${datePart} – ${timePart}`;
}

/**
 * GET /api/presentations/student-view
 * Student-only: returns their own group number + assigned presentation time.
 * Supervisor name is intentionally excluded from this response.
 */
async function getStudentPresentationView(req, res) {
  try {
    const studentId = req.user.id;

    // Find the group this student belongs to
    const { data: membership, error: memError } = await supabaseAdmin
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    if (memError) throw memError;

    if (!membership) {
      return res.json({ group: null, schedule: null });
    }

    const groupId = membership.group_id;

    // Fetch group info — intentionally excludes supervisor fields
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code, group_number, project_name')
      .eq('id', groupId)
      .single();

    if (groupError) throw groupError;

    // Fetch presentation schedule — excludes committee_members to hide supervisor data
    const { data: schedule, error: schedError } = await supabaseAdmin
      .from('presentation_schedules')
      .select('day, time_slot, scheduled_at, location')
      .eq('group_id', groupId)
      .maybeSingle();

    if (schedError) throw schedError;

    return res.json({
      group: group
        ? {
            id: group.id,
            groupCode: group.group_code,
            groupNumber: group.group_number,
            projectName: group.project_name,
          }
        : null,
      schedule: schedule
        ? {
            day: schedule.day,
            timeSlot: schedule.time_slot,
            scheduledAt: schedule.scheduled_at ?? null,
            location: schedule.location ?? null,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching student presentation view:', error);
    res.status(500).json({ error: 'Failed to fetch presentation data' });
  }
}

/**
 * GET /api/presentations/by-course?courseId=<uuid>
 * Admin / Coordinator: returns all presentation schedules for a given course.
 * Coordinator is automatically scoped to their assigned course by middleware.
 */
async function getPresentationsByCourse(req, res) {
  try {
    const { courseId } = req.query;
    const isAdmin = req.user.roles.includes('admin');

    // Coordinators are restricted to their assigned course
    const effectiveCourseId = isAdmin
      ? courseId
      : req.user.coordinatorCourseId;

    if (!effectiveCourseId) {
      return res.status(400).json({ error: 'courseId is required' });
    }

    // Coordinator scope check
    if (!isAdmin && courseId && courseId !== req.user.coordinatorCourseId) {
      return res.status(403).json({ error: 'Access denied: course scope mismatch' });
    }

    // Get all groups for this course
    const { data: groups, error: groupsError } = await supabaseAdmin
      .from('groups')
      .select('id, group_code, group_number, project_name')
      .eq('course_id', effectiveCourseId)
      .order('group_number', { ascending: true });

    if (groupsError) throw groupsError;

    const groupIds = (groups || []).map((g) => g.id);

    // Get all presentation schedules for these groups
    let schedules = [];
    if (groupIds.length > 0) {
      const { data: schedData, error: schedError } = await supabaseAdmin
        .from('presentation_schedules')
        .select('group_id, day, time_slot, committee_members, scheduled_at, location')
        .in('group_id', groupIds);

      if (schedError) throw schedError;
      schedules = schedData || [];
    }

    const scheduleMap = new Map(schedules.map((s) => [s.group_id, s]));

    const result = (groups || []).map((g) => {
      const schedule = scheduleMap.get(g.id);
      return {
        groupId: g.id,
        groupCode: g.group_code,
        groupNumber: g.group_number,
        projectName: g.project_name,
        day: schedule?.day ?? null,
        timeSlot: schedule?.time_slot ?? null,
        committeeMembers: schedule?.committee_members ?? [],
        scheduledAt: schedule?.scheduled_at ?? null,
        location: schedule?.location ?? null,
      };
    });

    return res.json(result);
  } catch (error) {
    console.error('Error fetching presentations by course:', error);
    res.status(500).json({ error: 'Failed to fetch presentations' });
  }
}

/**
 * GET /api/presentations/server-time
 * Authenticated — returns the current server UTC timestamp.
 * Used by the frontend to validate date selection against server time
 * without relying on client/browser time.
 */
async function getServerTime(req, res) {
  return res.json({ now: new Date().toISOString() });
}

/**
 * POST /api/presentations/assign
 * Admin / Coordinator — create or update a presentation schedule entry.
 *
 * Body: { groupId, scheduledAt, day, timeSlot, committeeMembers? }
 *
 * Backend enforces:
 *  - scheduledAt must be a valid future ISO datetime (vs server time).
 *  - Coordinator is scoped to their assigned course.
 *  - Auto-creates / updates a linked calendar event.
 *  - Auto-creates an announcement with the formatted real date and time.
 *
 * Gracefully falls back if the scheduled_at / calendar_event_id columns have
 * not yet been migrated (column missing → store day/time_slot only).
 */
async function assignSchedule(req, res) {
  try {
    const { groupId, scheduledAt, day, timeSlot, committeeMembers, location } = req.body;
    const isAdmin = (req.user.roles || []).includes('admin');

    // ── Validate required fields ───────────────────────────────────────────
    if (!groupId || !scheduledAt || !day || !timeSlot) {
      return res.status(400).json({
        error: 'groupId, scheduledAt, day, and timeSlot are required',
      });
    }

    // ── Validate scheduledAt against server time ───────────────────────────
    const presentationDate = new Date(scheduledAt);
    if (isNaN(presentationDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt: must be an ISO datetime string' });
    }
    // Admins can publish/update schedules for any date (e.g. correcting committee
    // members after the fact). Only coordinators are restricted to future dates.
    const now = new Date();
    if (!isAdmin && presentationDate <= now) {
      return res.status(400).json({
        error: 'Presentation date must be in the future',
        serverTime: now.toISOString(),
      });
    }

    // ── Coordinator scope: group must belong to their course ──────────────
    if (!isAdmin) {
      const { data: grp, error: grpErr } = await supabaseAdmin
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .single();
      if (grpErr || !grp) {
        return res.status(404).json({ error: 'Group not found' });
      }
      if (grp.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({
          error: 'Access denied: group does not belong to your assigned course',
        });
      }
    }

    // ── Fetch group info for announcement text + supervisor conflict check ──
    const { data: groupData } = await supabaseAdmin
      .from('groups')
      .select('project_name, group_code, group_number, supervisor_id, supervisor:profiles!supervisor_id(name)')
      .eq('id', groupId)
      .single();
    const projectName = groupData?.project_name ?? 'Unknown Project';

    // ── Reject if group's own supervisor is listed as a committee member ───
    if (committeeMembers && committeeMembers.length > 0 && groupData?.supervisor?.name) {
      const supervisorName = groupData.supervisor.name.trim().toLowerCase();
      const conflict = committeeMembers.find(m => m.trim().toLowerCase() === supervisorName);
      if (conflict) {
        return res.status(400).json({
          error: `The group's supervisor (${groupData.supervisor.name}) cannot be a committee member for their own group.`,
        });
      }
    }

    // ── Fetch existing schedule to get linked calendar_event_id ───────────
    const { data: existing } = await supabaseAdmin
      .from('presentation_schedules')
      .select('calendar_event_id')
      .eq('group_id', groupId)
      .maybeSingle();
    const existingCalendarEventId = existing?.calendar_event_id ?? null;

    // ── Create or update linked calendar event ─────────────────────────────
    // For coordinator-published events, scope the event to their course so
    // they can manage (delete) it from the Calendar page. Admin events have
    // no course scope (visible platform-wide).
    const calendarPayload = {
      title: `Presentation: ${projectName}`,
      date: presentationDate.toISOString().slice(0, 10), // YYYY-MM-DD
      type: 'presentation',
      time: timeSlot,
      ...(!isAdmin && req.user.coordinatorCourseId ? { course_id: req.user.coordinatorCourseId } : {}),
    };
    let calendarEventId = existingCalendarEventId;

    if (existingCalendarEventId) {
      const { error: calUpdateErr } = await supabaseAdmin
        .from('calendar_events')
        .update(calendarPayload)
        .eq('id', existingCalendarEventId);
      if (calUpdateErr) console.warn('[presentations] Failed to update calendar event:', calUpdateErr);
    } else {
      const { data: calEvt, error: calErr } = await supabaseAdmin
        .from('calendar_events')
        .insert(calendarPayload)
        .select('id')
        .single();
      if (!calErr && calEvt) calendarEventId = calEvt.id;
    }

    // ── Upsert presentation schedule (manual UPDATE → INSERT) ─────────────
    // Avoids relying on onConflict which requires a DB unique constraint.
    //
    // coreFields  – columns guaranteed to exist in any schema version
    // allFields   – includes columns added in migration 004 (committee_members,
    //               scheduled_at, calendar_event_id); tried first, falls back
    //               to coreFields only when a column-missing error is returned.
    const coreFields = { day, time_slot: timeSlot };
    const allFields  = {
      ...coreFields,
      committee_members: committeeMembers ?? [],
      scheduled_at: presentationDate.toISOString(),
      calendar_event_id: calendarEventId,
      location: location ?? null,
    };

    // 1. Try UPDATE existing row (all fields first, then core-only fallback)
    let updatedCount = 0;
    let usedFallback = false;

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from('presentation_schedules')
      .update(allFields)
      .eq('group_id', groupId)
      .select('id');

    if (updateErr && isMissingTable(updateErr)) {
      // Table doesn't exist — migration 004 has not been run
      return res.status(503).json({
        error: 'Presentation schedules table is not set up. Please run migration 004_presentation_schedules.sql in the Supabase SQL editor.',
      });
    } else if (updateErr && isMissingColumn(updateErr)) {
      // One or more new columns are missing — fall back to core fields only
      usedFallback = true;
      const { data: updated2, error: updateErr2 } = await supabaseAdmin
        .from('presentation_schedules')
        .update(coreFields)
        .eq('group_id', groupId)
        .select('id');
      if (updateErr2) throw updateErr2;
      updatedCount = updated2?.length ?? 0;
    } else if (updateErr) {
      throw updateErr;
    } else {
      updatedCount = updated?.length ?? 0;
    }

    // 2. No existing row — INSERT
    if (updatedCount === 0) {
      const insertPayload = usedFallback
        ? { group_id: groupId, ...coreFields }
        : { group_id: groupId, ...allFields };

      const { error: insertErr } = await supabaseAdmin
        .from('presentation_schedules')
        .insert(insertPayload);

      if (insertErr && isMissingColumn(insertErr) && !usedFallback) {
        // Retry with core fields only
        const { error: insertErr2 } = await supabaseAdmin
          .from('presentation_schedules')
          .insert({ group_id: groupId, ...coreFields });
        if (insertErr2) throw insertErr2;
      } else if (insertErr) {
        throw insertErr;
      }
    }

    // ── Announcement (broadcast to students & supervisors) ─────────────────
    const formatted = formatPresentationDateTime(presentationDate);
    const locationLine = location ? `\nLocation: ${location}` : '';
    const announcementContent = [
      `A presentation slot has been scheduled for ${projectName}.`,
      '',
      `Date & Time: ${formatted}`,
      `Day / Slot: ${day} – ${timeSlot}`,
      ...(location ? [`Location: ${location}`] : []),
    ].join('\n');

    const { error: announcementErr } = await supabaseAdmin.from('announcements').insert({
      title: `Presentation Scheduled: ${projectName}`,
      content: announcementContent,
      author_id: req.user.id,
      target_roles: ['student', 'supervisor', 'coordinator'],
      published_at: new Date().toISOString(),
      expires_at: null,
    });
    if (announcementErr) console.warn('[presentations] Failed to create announcement:', announcementErr);

    // ── Per-student notifications (bell icon) ──────────────────────────────
    // Each student in the group receives a personal notification with only
    // their own presentation date, time, and location.
    const locationText = location ? `\nLocation: ${location}` : '';

    const { data: members, error: membersErr } = await supabaseAdmin
      .from('group_members')
      .select('student_id')
      .eq('group_id', groupId);

    if (membersErr) {
      console.warn('[presentations] Failed to fetch group members for notifications:', membersErr);
    } else if (members && members.length > 0) {
      const notificationRows = members.map(m => ({
        user_id: m.student_id,
        type: 'presentation',
        title: 'Your Presentation Has Been Scheduled',
        message: `Your presentation is scheduled on:\n\nDate & Time: ${formatted}${locationText}`,
        read: false,
      }));

      const { error: notifErr } = await supabaseAdmin
        .from('notifications')
        .insert(notificationRows);

      if (notifErr) console.warn('[presentations] Failed to send student notifications:', notifErr);

      // ── Fire-and-forget email to group members ─────────────────────────────
      const memberIds = members.map((m) => m.student_id);
      supabaseAdmin
        .from('profiles')
        .select('email')
        .in('id', memberIds)
        .then(({ data: memberProfiles }) => {
          const memberEmails = (memberProfiles || []).map((p) => p.email).filter(Boolean);
          if (memberEmails.length > 0) {
            emailService.sendPresentationScheduled(memberEmails, {
              projectName,
              formattedDateTime: formatted,
              location: location ?? null,
              timeSlot,
              day,
            }).catch(console.error);
          }
        })
        .catch((err) => console.error('[presentations] Failed to send presentation email:', err.message));
    }

    res.json({ success: true });

    // ── Trigger 7: per-committee-member announcement + notification + personal calendar ───
    if (committeeMembers && committeeMembers.length > 0) {
      ;(async () => {
        try {
          const { data: committeeMemberProfiles } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email')
            .in('name', committeeMembers);

          // Fetch group students for the notification message
          const groupStudents = await notificationService.getGroupMembers(groupId);
          const studentNames  = groupStudents.map((s) => s.name).join(', ') || 'N/A';
          const formattedDate = formatPresentationDateTime(presentationDate);
          const supervisorName = groupData?.supervisor?.name ?? 'N/A';
          const groupNum       = groupData?.group_number ?? '';
          const courseId       = await notificationService.getCourseIdFromGroup(groupId);

          const announcementContent = [
            `You have been assigned as a committee evaluator for the following group:`,
            '',
            `Group: ${projectName}${groupNum ? ` (Group ${groupNum})` : ''}`,
            `Students: ${studentNames}`,
            `Supervisor: ${supervisorName}`,
            `Evaluation Date & Time: ${formattedDate}`,
            ...(location ? [`Location: ${location}`] : []),
          ].join('\n');

          for (const profile of (committeeMemberProfiles || [])) {
            if (!profile.id) continue;

            // Scope the announcement to the committee member's OWN supervised group.
            // • Supervisor mode:   group filter shows group_id in viewer's groups → VISIBLE only to them.
            // • Coordinator mode:  coordinator filter requires group_id IS NULL     → HIDDEN.
            // This works even when the same user holds both roles simultaneously.
            const { data: memberGroup } = await supabaseAdmin
              .from('groups')
              .select('id')
              .eq('supervisor_id', profile.id)
              .limit(1)
              .maybeSingle();
            const memberGroupId = memberGroup?.id ?? null;

            await Promise.all([
              notificationService.createAnnouncement({
                title:       `Committee Assignment: ${projectName}`,
                content:     announcementContent,
                targetRoles: ['supervisor'],
                courseId:    null,
                groupId:     memberGroupId,
                authorId:    req.user.id,
                expiresAt:   presentationDate.toISOString().slice(0, 10),
              }),
              notificationService.createUserNotifications([profile.id], {
                type:    'presentation',
                title:   'You Are Assigned as Committee Evaluator',
                message: [
                  `Group: ${projectName}${groupNum ? ` (Group ${groupNum})` : ''}`,
                  `Students: ${studentNames}`,
                  `Supervisor: ${supervisorName}`,
                  `Date & Time: ${formattedDate}`,
                  location ? `Location: ${location}` : null,
                ].filter(Boolean).join('\n'),
                link:    '/supervisor/grades-committee',
              }),
              notificationService.createPersonalCalendarEvent({
                title:    `Committee Evaluation: ${projectName}`,
                date:     presentationDate.toISOString().slice(0, 10),
                type:     'presentation',
                time:     timeSlot,
                location: location ?? null,
                userId:   profile.id,
              }),
            ]);
          }
        } catch (e) {
          console.error('[presentations] Trigger-7 committee notification error:', e.message);
        }
      })();
    }

    // ── Fire-and-forget committee emails ───────────────────────────────────
    // For each committee member, fetch ALL presentations they are assigned to
    // and send a consolidated schedule email.
    if (committeeMembers && committeeMembers.length > 0) {
      ;(async () => {
        try {
          // Look up committee member emails by name
          const { data: memberProfiles } = await supabaseAdmin
            .from('profiles')
            .select('name, email')
            .in('name', committeeMembers);

          if (!memberProfiles || memberProfiles.length === 0) return;

          // Fetch all presentation schedules to find each member's full list
          const { data: allSchedules } = await supabaseAdmin
            .from('presentation_schedules')
            .select('group_id, committee_members, scheduled_at, day, time_slot, location');

          const { data: allGroups } = await supabaseAdmin
            .from('groups')
            .select('id, project_name, group_code');

          const groupMap = new Map((allGroups || []).map((g) => [g.id, g]));

          for (const profile of memberProfiles) {
            if (!profile.email) continue;

            const mySchedules = (allSchedules || []).filter(
              (s) => Array.isArray(s.committee_members) && s.committee_members.includes(profile.name)
            );

            if (mySchedules.length === 0) continue;

            const assignments = mySchedules.map((s) => {
              const grp = groupMap.get(s.group_id);
              const dt = s.scheduled_at ? formatPresentationDateTime(new Date(s.scheduled_at)) : `${s.day} – ${s.time_slot}`;
              return {
                projectName: grp?.project_name ?? 'Unknown Project',
                groupCode: grp?.group_code ?? '',
                formattedDateTime: dt,
                day: s.day,
                timeSlot: s.time_slot,
                location: s.location ?? null,
              };
            });

            emailService.sendCommitteeSchedule(profile.email, {
              memberName: profile.name,
              assignments,
            }).catch(console.error);
          }
        } catch (e) {
          console.error('[presentations] Failed to send committee emails:', e);
        }
      })();
    }
  } catch (error) {
    console.error('Error assigning presentation schedule:', error);
    res.status(500).json({
      error: 'Failed to assign presentation schedule',
      detail: error?.message ?? String(error),
    });
  }
}

/**
 * DELETE /api/presentations/schedule/:groupId
 * Admin / Coordinator — remove a presentation schedule and its linked calendar event.
 */
async function deleteSchedule(req, res) {
  try {
    const { groupId } = req.params;
    const isAdmin = (req.user.roles || []).includes('admin');

    // Fetch existing schedule
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('presentation_schedules')
      .select('calendar_event_id')
      .eq('group_id', groupId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!existing) return res.status(404).json({ error: 'Schedule not found' });

    // Coordinator scope check
    if (!isAdmin) {
      const { data: grp } = await supabaseAdmin
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .single();
      if (!grp || grp.course_id !== req.user.coordinatorCourseId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Delete linked calendar event
    if (existing.calendar_event_id) {
      const { error: calDeleteErr } = await supabaseAdmin
        .from('calendar_events')
        .delete()
        .eq('id', existing.calendar_event_id);
      if (calDeleteErr) console.warn('[presentations] Failed to delete linked calendar event:', calDeleteErr);
    }

    // Delete the schedule row
    const { error: delErr } = await supabaseAdmin
      .from('presentation_schedules')
      .delete()
      .eq('group_id', groupId);
    if (delErr) throw delErr;

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting presentation schedule:', error);
    res.status(500).json({ error: 'Failed to delete presentation schedule' });
  }
}

module.exports = {
  getStudentPresentationView,
  getPresentationsByCourse,
  getServerTime,
  assignSchedule,
  deleteSchedule,
};
