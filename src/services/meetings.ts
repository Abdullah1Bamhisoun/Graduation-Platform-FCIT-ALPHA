import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'live' | 'finished';
export type CreatorRole   = 'coordinator' | 'supervisor';

export interface MeetingParticipant {
  id:           string;
  user_id:      string;
  role:         'student' | 'supervisor' | 'coordinator';
  email_sent:   boolean;
  reminder_24h: boolean;
  reminder_1h:  boolean;
  reminder_10m: boolean;
}

export interface Meeting {
  id:           string;
  title:        string;
  meeting_url:  string;
  date_time:    string;
  status:       MeetingStatus;
  notes?:       string | null;
  creator_role: CreatorRole;
  created_by:   string;
  created_at:   string;
  group_id?:    string;
  groups?:      { id: string; name: string } | null;
  profiles?:    { id: string; name: string; email: string };
  meeting_participants?: MeetingParticipant[];
}

export interface CreateMeetingPayload {
  title:       string;
  meeting_url: string;
  date_time:   string;
  group_id:    string;
  notes?:      string;
}

export interface UpdateMeetingPayload {
  title?:       string;
  meeting_url?: string;
  date_time?:   string;
  notes?:       string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupDisplayName(g: any): string {
  if (!g) return 'Unknown Group';
  return g.project_name || g.group_code || `Group ${g.group_number}`;
}

export function getMeetingStatus(dateTime: string): MeetingStatus {
  const now    = new Date();
  const dt     = new Date(dateTime);
  const diffMs = now.getTime() - dt.getTime();
  if (diffMs < 0)              return 'scheduled';
  if (diffMs < 60 * 60 * 1000) return 'live';
  return 'finished';
}

// Keep backward-compat alias
export const resolveStatus = getMeetingStatus;

export function statusLabel(status: MeetingStatus): string {
  return status === 'scheduled' ? 'Scheduled'
       : status === 'live'      ? 'Live Now'
       : 'Finished';
}

export function statusColors(status: MeetingStatus) {
  return status === 'live'
    ? { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-400 animate-pulse' }
    : status === 'scheduled'
    ? { bg: 'bg-blue-50',  text: 'text-blue-700',  dot: 'bg-blue-400' }
    : { bg: 'bg-gray-100', text: 'text-gray-500',  dot: 'bg-gray-400' };
}

export function detectMeetingProvider(url: string): string {
  if (/meet\.google\.com/i.test(url))      return 'Google Meet';
  if (/zoom\.us/i.test(url))              return 'Zoom';
  if (/teams\.microsoft\.com/i.test(url)) return 'Microsoft Teams';
  return 'Custom Link';
}

function normalize(rows: any[]): Meeting[] {
  return (rows || []).map((m) => ({
    ...m,
    groups: m.groups ? { id: m.groups.id, name: groupDisplayName(m.groups) } : null,
    status: getMeetingStatus(m.date_time),
  }));
}

// ─── Direct Supabase queries ──────────────────────────────────────────────────

const BASE_SELECT = '*, groups ( id, project_name, group_code, group_number )';

export async function listMeetings(activeRole: string): Promise<Meeting[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('meetings')
    .select(BASE_SELECT)
    .order('date_time', { ascending: true });

  if (activeRole === 'coordinator' || activeRole === 'admin') {
    // Coordinator sees only meetings they created with coordinator role
    query = query
      .eq('created_by', user.id)
      .eq('creator_role', 'coordinator');
  }
  // supervisor and student: RLS policies handle the row-level filtering

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return normalize(data || []);
}

export async function getMeeting(id: string): Promise<Meeting> {
  const { data, error } = await supabase
    .from('meetings')
    .select(BASE_SELECT)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  return normalize([data])[0];
}

export async function createMeeting(
  payload: CreateMeetingPayload,
  activeRole: string
): Promise<Meeting> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const creatorRole: CreatorRole = activeRole === 'supervisor' ? 'supervisor' : 'coordinator';

  const { data: meeting, error } = await supabase
    .from('meetings')
    .insert({
      title:        payload.title,
      meeting_url:  payload.meeting_url,
      date_time:    payload.date_time,
      group_id:     payload.group_id,
      notes:        payload.notes ?? null,
      created_by:   user.id,
      creator_role: creatorRole,
      status:       getMeetingStatus(payload.date_time),
    })
    .select(BASE_SELECT)
    .single();

  if (error) throw new Error(error.message);

  // Insert participants (best-effort — non-fatal)
  insertParticipants(meeting.id, payload.group_id, user.id, creatorRole).catch(() => {});

  return normalize([meeting])[0];
}

async function insertParticipants(
  meetingId: string,
  groupId:   string,
  _creatorId: string,
  creatorRole: CreatorRole
) {
  const [membersRes, groupRes] = await Promise.all([
    supabase.from('group_members').select('student_id').eq('group_id', groupId),
    supabase.from('groups').select('supervisor_id').eq('id', groupId).single(),
  ]);

  const participants: { meeting_id: string; user_id: string; role: string }[] = [];

  for (const m of membersRes.data || []) {
    if (m.student_id) {
      participants.push({ meeting_id: meetingId, user_id: m.student_id, role: 'student' });
    }
  }

  if (creatorRole === 'coordinator' && groupRes.data?.supervisor_id) {
    participants.push({ meeting_id: meetingId, user_id: groupRes.data.supervisor_id, role: 'supervisor' });
  }

  if (participants.length > 0) {
    await supabase.from('meeting_participants').insert(participants);
  }
}

export async function updateMeeting(
  id:      string,
  payload: UpdateMeetingPayload
): Promise<Meeting> {
  const updates: any = { ...payload };
  if (payload.date_time) updates.status = getMeetingStatus(payload.date_time);

  const { data, error } = await supabase
    .from('meetings')
    .update(updates)
    .eq('id', id)
    .select(BASE_SELECT)
    .single();

  if (error) throw new Error(error.message);
  return normalize([data])[0];
}

export async function deleteMeeting(id: string): Promise<void> {
  const { error } = await supabase.from('meetings').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Resend invitation — no-op without backend email service
export async function resendInvitation(
  _id: string,
  _activeRole: string
): Promise<{ message: string }> {
  return { message: 'Email invitations require the backend service' };
}
