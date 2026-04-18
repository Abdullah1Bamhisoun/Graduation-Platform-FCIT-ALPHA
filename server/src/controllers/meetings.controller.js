'use strict';

/**
 * Meetings Controller
 *
 * Role-based visibility rules:
 *   Coordinator — sees only meetings they created
 *   Supervisor  — sees coordinator meetings for their groups + their own meetings
 *   Student     — sees all meetings for their group (both creator roles)
 *
 * Key facts about the groups table:
 *   • Group display name column is `project_name` (there is no `name` column)
 *   • Fallback: group_code, group_number
 *
 * Supabase FK join rules used here:
 *   • profiles joined via meetings.created_by  → profiles!created_by(...)
 *   Avoid implicit joins when multiple FKs to the same table exist.
 *
 * creator_role DB constraint: ('coordinator', 'supervisor') only.
 *   Admin users are stored as 'coordinator' in this field.
 */

const { supabaseAdmin } = require('../config/supabase');
const {
  queueMeetingInvitationEmail,
  queueMeetingReminderEmail,
  queueMeetingCancelledEmail,
} = require('../services/queue.service');
const { APP_URL } = require('../config/env');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveStatus(dateTime) {
  const now   = Date.now();
  const start = new Date(dateTime).getTime();
  const end   = start + 60 * 60 * 1000;
  if (now < start) return 'scheduled';
  if (now <= end)  return 'live';
  return 'finished';
}

/** Map activeRole → DB-allowed creator_role value. Admin acts as coordinator. */
function toCreatorRole(activeRole) {
  if (activeRole === 'supervisor') return 'supervisor';
  return 'coordinator'; // coordinator OR admin
}

/** Derive a human-readable group name from a groups row. */
function groupDisplayName(g) {
  if (!g) return 'Unknown Group';
  return g.project_name || g.group_code || `Group ${g.group_number}`;
}

/**
 * Fetch all participant emails for a meeting.
 * Uses a separate profiles query instead of joins to avoid FK ambiguity.
 */
async function fetchParticipantEmails(meetingId) {
  const { data: participants } = await supabaseAdmin
    .from('meeting_participants')
    .select('user_id, role')
    .eq('meeting_id', meetingId);

  if (!participants || participants.length === 0) {
    return { studentEmails: [], supervisorEmail: null, allEmails: [] };
  }

  const userIds = participants.map((p) => p.user_id);
  const { data: profiles } = await supabaseAdmin
    .from('profiles').select('id, email').in('id', userIds);

  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.email]));

  const studentEmails = [];
  let   supervisorEmail = null;
  const allEmails = [];

  for (const p of participants) {
    const email = profileMap[p.user_id];
    if (!email) continue;
    allEmails.push(email);
    if (p.role === 'student')    studentEmails.push(email);
    if (p.role === 'supervisor') supervisorEmail = email;
  }

  return { studentEmails, supervisorEmail, allEmails };
}

/**
 * Insert participants for a meeting and return emails for invitation sending.
 * All profile lookups done via separate queries — no FK join ambiguity.
 */
async function insertParticipants(meetingId, groupId) {
  const participantRows = [];

  // Students from group_members
  const { data: members } = await supabaseAdmin
    .from('group_members').select('student_id').eq('group_id', groupId);

  const studentIds = (members || []).map((m) => m.student_id).filter(Boolean);
  for (const sid of studentIds) {
    participantRows.push({ meeting_id: meetingId, user_id: sid, role: 'student' });
  }

  // Supervisor from groups
  const { data: group } = await supabaseAdmin
    .from('groups').select('supervisor_id').eq('id', groupId).single();

  const supervisorId = group?.supervisor_id ?? null;
  if (supervisorId) {
    participantRows.push({ meeting_id: meetingId, user_id: supervisorId, role: 'supervisor' });
  }

  if (participantRows.length > 0) {
    await supabaseAdmin
      .from('meeting_participants')
      .upsert(participantRows, { onConflict: 'meeting_id,user_id' });
  }

  // Fetch emails in one query
  const allIds = [...studentIds, ...(supervisorId ? [supervisorId] : [])];
  if (allIds.length === 0) return { studentEmails: [], supervisorEmail: null };

  const { data: profileRows } = await supabaseAdmin
    .from('profiles').select('id, email').in('id', allIds);

  const profileMap = Object.fromEntries((profileRows || []).map((p) => [p.id, p.email]));

  return {
    studentEmails:   studentIds.map((sid) => profileMap[sid]).filter(Boolean),
    supervisorEmail: supervisorId ? (profileMap[supervisorId] ?? null) : null,
    supervisorId:    supervisorId ?? null,
  };
}

// ─── Base select (no `groups.name` — column is `project_name`) ───────────────

const BASE_SELECT = `
  id, title, meeting_url, date_time, status, notes, creator_role,
  created_at, created_by, group_id,
  groups ( id, project_name, group_code, group_number )
`;

// ─── List meetings ────────────────────────────────────────────────────────────

async function listMeetings(req, res) {
  try {
    const { activeRole, id: userId } = req.user;
    let meetings;

    if (activeRole === 'admin') {
      const { data, error } = await supabaseAdmin
        .from('meetings').select(BASE_SELECT).order('date_time', { ascending: true });
      if (error) throw error;
      meetings = data;

    } else if (activeRole === 'coordinator') {
      const { data, error } = await supabaseAdmin
        .from('meetings').select(BASE_SELECT)
        .eq('created_by', userId)
        .eq('creator_role', 'coordinator')
        .order('date_time', { ascending: true });
      if (error) throw error;
      meetings = data;

    } else if (activeRole === 'supervisor') {
      const { data: supervisedGroups } = await supabaseAdmin
        .from('groups').select('id').eq('supervisor_id', userId);

      const groupIds = (supervisedGroups || []).map((g) => g.id);
      if (groupIds.length === 0) return res.json([]);

      // Two queries merged — avoids unreliable nested .or(and(...)) syntax
      const [coordResult, ownResult] = await Promise.all([
        supabaseAdmin
          .from('meetings').select(BASE_SELECT)
          .eq('creator_role', 'coordinator')
          .in('group_id', groupIds)
          .order('date_time', { ascending: true }),
        supabaseAdmin
          .from('meetings').select(BASE_SELECT)
          .eq('created_by', userId)
          .order('date_time', { ascending: true }),
      ]);

      if (coordResult.error) throw coordResult.error;
      if (ownResult.error)   throw ownResult.error;

      const seen = new Set();
      meetings = [];
      for (const m of [...(coordResult.data || []), ...(ownResult.data || [])]) {
        if (!seen.has(m.id)) { seen.add(m.id); meetings.push(m); }
      }
      meetings.sort((a, b) => new Date(a.date_time) - new Date(b.date_time));

    } else if (activeRole === 'student') {
      const { data: memberRow } = await supabaseAdmin
        .from('group_members').select('group_id').eq('student_id', userId).maybeSingle();

      if (!memberRow?.group_id) return res.json([]);

      // For students, also join creator name via explicit FK hint
      const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`${BASE_SELECT}, profiles!created_by ( id, name )`)
        .eq('group_id', memberRow.group_id)
        .order('date_time', { ascending: true });
      if (error) throw error;
      meetings = data;

    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const enriched = (meetings || []).map((m) => ({
      ...m,
      groups: m.groups
        ? { ...m.groups, name: groupDisplayName(m.groups) }
        : null,
      status: resolveStatus(m.date_time),
    }));

    return res.json(enriched);
  } catch (err) {
    console.error('[meetings] listMeetings error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to fetch meetings', detail: err.message });
  }
}

// ─── Get single meeting ───────────────────────────────────────────────────────

async function getMeeting(req, res) {
  try {
    const { activeRole, id: userId } = req.user;
    const { id } = req.params;

    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .select(`
        id, title, meeting_url, date_time, status, notes, creator_role,
        created_at, created_by, group_id,
        groups ( id, project_name, group_code, group_number ),
        profiles!created_by ( id, name, email ),
        meeting_participants ( id, user_id, role, email_sent, reminder_24h, reminder_1h, reminder_10m )
      `)
      .eq('id', id)
      .single();

    if (error || !meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (activeRole === 'coordinator' && meeting.created_by !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (activeRole === 'supervisor') {
      const { data: supervisedGroups } = await supabaseAdmin
        .from('groups').select('id').eq('supervisor_id', userId);
      const groupIds = (supervisedGroups || []).map((g) => g.id);
      const canSee =
        (meeting.creator_role === 'coordinator' && groupIds.includes(meeting.group_id)) ||
        meeting.created_by === userId;
      if (!canSee) return res.status(403).json({ error: 'Access denied' });
    }

    if (activeRole === 'student') {
      const { data: memberRow } = await supabaseAdmin
        .from('group_members').select('group_id').eq('student_id', userId).maybeSingle();
      if (!memberRow || memberRow.group_id !== meeting.group_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    return res.json({
      ...meeting,
      groups: meeting.groups ? { ...meeting.groups, name: groupDisplayName(meeting.groups) } : null,
      status: resolveStatus(meeting.date_time),
    });
  } catch (err) {
    console.error('[meetings] getMeeting error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to fetch meeting', detail: err.message });
  }
}

// ─── Create meeting ───────────────────────────────────────────────────────────

async function createMeeting(req, res) {
  try {
    const { activeRole, id: userId, name: creatorName } = req.user;
    const { title, meeting_url, location, date_time, group_id, notes, invite_supervisor_ids = [] } = req.body;

    // Supervisor can only create for their own groups
    if (activeRole === 'supervisor') {
      const { data: group } = await supabaseAdmin
        .from('groups').select('supervisor_id').eq('id', group_id).single();
      if (!group || group.supervisor_id !== userId) {
        return res.status(403).json({ error: 'You are not the supervisor of this group' });
      }
    }

    // Fetch group name before insert (project_name, not name)
    const { data: groupRow } = await supabaseAdmin
      .from('groups')
      .select('project_name, group_code, group_number')
      .eq('id', group_id)
      .single();

    const groupName = groupDisplayName(groupRow);

    const { data: meeting, error } = await supabaseAdmin
      .from('meetings')
      .insert({
        title,
        meeting_url:  meeting_url  || null,
        location:     location     || null,
        date_time,
        group_id,
        created_by:   userId,
        creator_role: toCreatorRole(activeRole),
        notes:        notes ?? null,
        status:       resolveStatus(date_time),
      })
      .select('*')
      .single();

    if (error) throw error;

    const { studentEmails, supervisorEmail, supervisorId } = await insertParticipants(meeting.id, group_id);

    const includeSupervisor =
      activeRole !== 'supervisor' &&
      Array.isArray(invite_supervisor_ids) &&
      invite_supervisor_ids.length > 0 &&
      supervisorId != null &&
      invite_supervisor_ids.includes(supervisorId);

    const inviteEmails = includeSupervisor
      ? [...studentEmails, ...(supervisorEmail ? [supervisorEmail] : [])]
      : studentEmails;

    if (inviteEmails.length > 0) {
      await queueMeetingInvitationEmail(inviteEmails, {
        meetingTitle: title,
        groupName,
        dateTime:     date_time,
        meetingUrl:   meeting_url  ?? null,
        location:     location     ?? null,
        creatorName:  creatorName  ?? 'Platform',
        notes:        notes        ?? null,
        appUrl:       APP_URL      ?? '',
      });

      await supabaseAdmin
        .from('meeting_participants')
        .update({ email_sent: true })
        .eq('meeting_id', meeting.id);
    }

    return res.status(201).json({
      ...meeting,
      groups: { id: group_id, name: groupName },
      status: resolveStatus(meeting.date_time),
    });
  } catch (err) {
    console.error('[meetings] createMeeting error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to create meeting', detail: err.message });
  }
}

// ─── Update meeting ───────────────────────────────────────────────────────────

async function updateMeeting(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('meetings').select('*').eq('id', id).single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Meeting not found' });

    if (existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can edit this meeting' });
    }

    const patch = {};
    if (updates.title)              patch.title       = updates.title;
    if ('meeting_url' in updates)   patch.meeting_url = updates.meeting_url || null;
    if ('location' in updates)      patch.location    = updates.location    || null;
    if (updates.date_time)          patch.date_time   = updates.date_time;
    if ('notes' in updates)         patch.notes       = updates.notes ?? null;
    if (updates.date_time)          patch.status      = resolveStatus(updates.date_time);

    const { data: updated, error } = await supabaseAdmin
      .from('meetings')
      .update(patch)
      .eq('id', id)
      .select('*, groups(project_name, group_code, group_number)')
      .single();

    if (error) throw error;

    return res.json({
      ...updated,
      groups: updated.groups ? { ...updated.groups, name: groupDisplayName(updated.groups) } : null,
      status: resolveStatus(updated.date_time),
    });
  } catch (err) {
    console.error('[meetings] updateMeeting error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to update meeting', detail: err.message });
  }
}

// ─── Delete meeting ───────────────────────────────────────────────────────────

async function deleteMeeting(req, res) {
  try {
    const { id: userId, name: cancellerName } = req.user;
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('meetings')
      .select('*, groups(project_name, group_code, group_number)')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: 'Meeting not found' });

    if (existing.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can cancel this meeting' });
    }

    const { allEmails } = await fetchParticipantEmails(id);

    await supabaseAdmin.from('meetings').delete().eq('id', id);

    if (allEmails.length > 0) {
      await queueMeetingCancelledEmail(allEmails, {
        meetingTitle: existing.title,
        groupName:    groupDisplayName(existing.groups),
        dateTime:     existing.date_time,
        cancelledBy:  cancellerName ?? 'Platform',
      });
    }

    return res.status(204).send();
  } catch (err) {
    console.error('[meetings] deleteMeeting error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to delete meeting', detail: err.message });
  }
}

// ─── Resend invitation ────────────────────────────────────────────────────────

async function resendInvitation(req, res) {
  try {
    const { id: userId } = req.user;
    const { id } = req.params;

    const { data: meeting, error: fetchErr } = await supabaseAdmin
      .from('meetings')
      .select('*, groups(project_name, group_code, group_number)')
      .eq('id', id)
      .single();
    if (fetchErr || !meeting) return res.status(404).json({ error: 'Meeting not found' });

    if (meeting.created_by !== userId) {
      return res.status(403).json({ error: 'Only the meeting creator can resend invitations' });
    }

    const { allEmails } = await fetchParticipantEmails(id);

    if (allEmails.length > 0) {
      await queueMeetingInvitationEmail(allEmails, {
        meetingTitle: meeting.title,
        groupName:    groupDisplayName(meeting.groups),
        dateTime:     meeting.date_time,
        meetingUrl:   meeting.meeting_url,
        creatorName:  req.user.name ?? 'Platform',
        notes:        meeting.notes ?? null,
        appUrl:       APP_URL ?? '',
      });
    }

    return res.json({ message: `Invitation resent to ${allEmails.length} participant(s)` });
  } catch (err) {
    console.error('[meetings] resendInvitation error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to resend invitation', detail: err.message });
  }
}

// ─── Process reminders (cron) ─────────────────────────────────────────────────

async function processReminders(req, res) {
  try {
    const now = new Date();

    const { data: meetings, error } = await supabaseAdmin
      .from('meetings')
      .select(`
        id, title, meeting_url, date_time,
        groups ( project_name, group_code, group_number ),
        meeting_participants ( id, user_id, reminder_24h, reminder_1h, reminder_10m )
      `)
      .in('status', ['scheduled', 'live'])
      .gte('date_time', now.toISOString());

    if (error) throw error;

    let processed = 0;

    for (const meeting of meetings || []) {
      const diffMins = (new Date(meeting.date_time) - now) / 60000;
      const groupName = groupDisplayName(meeting.groups);
      const allParticipants = meeting.meeting_participants || [];

      const participantUserIds = allParticipants.map((p) => p.user_id);
      if (participantUserIds.length === 0) continue;

      const { data: profileRows } = await supabaseAdmin
        .from('profiles').select('email').in('id', participantUserIds);
      const emails = (profileRows || []).map((p) => p.email).filter(Boolean);
      if (emails.length === 0) continue;

      const reminderBase = {
        meetingTitle: meeting.title,
        groupName,
        dateTime:     meeting.date_time,
        meetingUrl:   meeting.meeting_url,
      };

      if (diffMins > 60 && diffMins <= 1440 && allParticipants.some((p) => !p.reminder_24h)) {
        await queueMeetingReminderEmail(emails, { ...reminderBase, reminderLabel: 'in 24 hours' });
        await supabaseAdmin.from('meeting_participants').update({ reminder_24h: true }).eq('meeting_id', meeting.id);
        processed++;
      }
      if (diffMins > 10 && diffMins <= 60 && allParticipants.some((p) => !p.reminder_1h)) {
        await queueMeetingReminderEmail(emails, { ...reminderBase, reminderLabel: 'in 1 hour' });
        await supabaseAdmin.from('meeting_participants').update({ reminder_1h: true }).eq('meeting_id', meeting.id);
        processed++;
      }
      if (diffMins > 0 && diffMins <= 10 && allParticipants.some((p) => !p.reminder_10m)) {
        await queueMeetingReminderEmail(emails, { ...reminderBase, reminderLabel: 'in 10 minutes' });
        await supabaseAdmin.from('meeting_participants').update({ reminder_10m: true }).eq('meeting_id', meeting.id);
        processed++;
      }

      const newStatus = resolveStatus(meeting.date_time);
      if (newStatus !== 'scheduled') {
        await supabaseAdmin.from('meetings').update({ status: newStatus }).eq('id', meeting.id);
      }
    }

    return res.json({ message: `Processed ${processed} reminder batch(es)` });
  } catch (err) {
    console.error('[meetings] processReminders error:', err.message ?? err);
    return res.status(500).json({ error: 'Failed to process reminders', detail: err.message });
  }
}

module.exports = {
  listMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  resendInvitation,
  processReminders,
};
