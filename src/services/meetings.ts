import { supabase } from '../lib/supabase';
import { apiUrl } from '@/lib/api';

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
  meeting_url:  string | null;
  location?:    string | null;
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
  title:             string;
  meeting_url?:      string | null;
  location?:         string | null;
  date_time:         string;
  group_id:          string;
  notes?:            string;
  invite_supervisor_ids?: string[];
}

export interface UpdateMeetingPayload {
  title?:       string;
  meeting_url?: string | null;
  location?:    string | null;
  date_time?:   string;
  notes?:       string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupDisplayName(g: any): string {
  if (!g) return 'Unknown Group';
  return g.project_name || g.name || g.group_code || `Group ${g.group_number}`;
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

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// ─── Read — direct Supabase (no email needed) ─────────────────────────────────

const BASE_SELECT = '*, groups ( id, project_name, group_code, group_number )';

export async function listMeetings(activeRole: string): Promise<Meeting[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  let query = supabase
    .from('meetings')
    .select(BASE_SELECT)
    .order('date_time', { ascending: true });

  if (activeRole === 'coordinator' || activeRole === 'admin') {
    query = query
      .eq('created_by', user.id)
      .eq('creator_role', 'coordinator');
  }

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

// ─── Write — via Express backend (handles email + participants atomically) ────

export async function createMeeting(
  payload: CreateMeetingPayload,
  activeRole: string
): Promise<Meeting> {
  const token = await getToken();
  const res = await fetch(apiUrl('/api/meetings'), {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      Authorization:   `Bearer ${token}`,
      'X-Active-Role': activeRole,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to create meeting');
  return normalize([body])[0];
}

export async function updateMeeting(
  id:      string,
  payload: UpdateMeetingPayload
): Promise<Meeting> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/meetings/${id}`), {
    method:  'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to update meeting');
  return normalize([body])[0];
}

export async function deleteMeeting(id: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/meetings/${id}`), {
    method:  'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 204) return;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to delete meeting');
}

export async function resendInvitation(
  id: string,
  _activeRole: string
): Promise<{ message: string }> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/meetings/${id}/resend-invitation`), {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Failed to resend invitation');
  return { message: body.message || 'Invitation resent' };
}
