import { supabase } from '../lib/supabase';
import { apiUrl } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MeetingStatus = 'scheduled' | 'live' | 'finished';
export type CreatorRole   = 'coordinator' | 'supervisor';

export interface MeetingParticipant {
  id:          string;
  user_id:     string;
  role:        'student' | 'supervisor' | 'coordinator';
  email_sent:  boolean;
  reminder_24h: boolean;
  reminder_1h:  boolean;
  reminder_10m: boolean;
  profiles?: { id: string; name: string; email: string };
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
  groups?:      { id: string; name: string };
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

// ─── Auth helper ──────────────────────────────────────────────────────────────

async function authHeaders(activeRole?: string): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token    = data.session?.access_token ?? '';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (activeRole) headers['X-Active-Role'] = activeRole;
  return headers;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function listMeetings(activeRole: string): Promise<Meeting[]> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl('/api/meetings'), { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function getMeeting(id: string, activeRole: string): Promise<Meeting> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl(`/api/meetings/${id}`), { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function createMeeting(
  payload: CreateMeetingPayload,
  activeRole: string
): Promise<Meeting> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl('/api/meetings'), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function updateMeeting(
  id: string,
  payload: UpdateMeetingPayload,
  activeRole: string
): Promise<Meeting> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl(`/api/meetings/${id}`), {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function deleteMeeting(id: string, activeRole: string): Promise<void> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl(`/api/meetings/${id}`), {
    method: 'DELETE',
    headers,
  });
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
}

export async function resendInvitation(id: string, activeRole: string): Promise<{ message: string }> {
  const headers = await authHeaders(activeRole);
  const res = await fetch(apiUrl(`/api/meetings/${id}/resend-invitation`), {
    method: 'POST',
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getMeetingStatus(dateTime: string): MeetingStatus {
  const now   = Date.now();
  const start = new Date(dateTime).getTime();
  const end   = start + 60 * 60 * 1000;
  if (now < start) return 'scheduled';
  if (now <= end)  return 'live';
  return 'finished';
}

export function statusLabel(status: MeetingStatus): string {
  if (status === 'scheduled') return 'Scheduled';
  if (status === 'live')      return 'Live Now';
  return 'Finished';
}

export function statusColors(status: MeetingStatus) {
  if (status === 'live')      return { bg: 'bg-green-100',  text: 'text-green-800',  dot: 'bg-green-500'  };
  if (status === 'finished')  return { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400'   };
  return                             { bg: 'bg-blue-100',   text: 'text-blue-800',   dot: 'bg-blue-500'   };
}

export function detectMeetingProvider(url: string): string {
  if (/meet\.google\.com/i.test(url))  return 'Google Meet';
  if (/zoom\.us/i.test(url))           return 'Zoom';
  if (/teams\.microsoft\.com/i.test(url)) return 'Microsoft Teams';
  return 'External Link';
}
