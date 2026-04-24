import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import type { PresentationSchedule, StudentPresentationSelection } from '../types';

// ─── Auth helper ──────────────────────────────────────────────────────────────
async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

// ─── Date utilities (server-validated) ───────────────────────────────────────

/**
 * Fetch current UTC time from the server.
 * Use this instead of `new Date()` to avoid relying on client/browser clock.
 */
export async function getServerTime(): Promise<Date> {
  try {
    const token = await getToken();
    const res = await apiFetch(apiUrl('/api/presentations/server-time'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { now } = await res.json();
    return new Date(now);
  } catch {
    // Fallback to local time only if server is unreachable
    return new Date();
  }
}

/**
 * Parse an ISO week string like "2026-W08" to the Monday of that week.
 * Returns null for invalid input.
 */
export function isoWeekToMonday(weekValue: string): Date | null {
  const match = weekValue.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const week = parseInt(match[2], 10);
  // ISO 8601: Jan 4 is always in week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon … 7=Sun
  const w1Monday = new Date(jan4);
  w1Monday.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday = new Date(w1Monday);
  monday.setDate(w1Monday.getDate() + (week - 1) * 7);
  return monday;
}

/**
 * Convert a Date to an ISO week string like "2026-W08".
 * Inverse of isoWeekToMonday.
 */
export function dateToIsoWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // In our display system the week starts on Sunday: treat Sunday as belonging
  // to the following ISO week (whose Monday is the very next day).
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  // Move to Thursday of the same ISO week to get the correct year and week number
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export interface SavedScheduleEntry {
  groupId: string;
  groupCode: string;
  groupNumber: number | null;
  projectName: string;
  day: string | null;
  timeSlot: string | null;
  committeeMembers: string[];
  scheduledAt: string | null;
  location: string | null;
}

/**
 * Fetch all saved presentation schedules for a given course (admin/coordinator).
 * Returns only entries that have at least a day and timeSlot saved.
 */
export async function getPresentationsByCourse(
  courseId: string
): Promise<SavedScheduleEntry[]> {
  const token = await getToken();
  const res = await apiFetch(
    apiUrl(`/api/presentations/by-course?courseId=${encodeURIComponent(courseId)}`),
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  return res.json();
}

const DAY_OFFSETS: Record<string, number> = { Sun: -1, Mon: 0, Tue: 1, Wed: 2, Thu: 3 };

/**
 * Compute the actual ISO datetime for a slot given the week, day, and time.
 * day: 'Sun'|'Mon'|'Tue'|'Wed'|'Thu'
 * time: '09:00 am' format
 */
export function computeScheduledAt(
  weekStart: string,
  day: string,
  startTime: string
): Date | null {
  const monday = isoWeekToMonday(weekStart);
  if (!monday) return null;
  const offset = DAY_OFFSETS[day];
  if (offset === undefined) return null;

  const date = new Date(monday);
  date.setDate(monday.getDate() + offset);

  // Parse "09:00 am" or "1:00 pm"
  const match = startTime.match(/(\d+):(\d+)\s*(am|pm)/i);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3].toLowerCase();
    if (ampm === 'pm' && hours !== 12) hours += 12;
    if (ampm === 'am' && hours === 12) hours = 0;
    date.setHours(hours, minutes, 0, 0);
  }
  return date;
}

// ─── Presentation assignment (backend-validated) ──────────────────────────────

export interface AssignSchedulePayload {
  groupId: string;
  scheduledAt: string;   // ISO datetime string
  day: string;
  timeSlot: string;
  committeeMembers?: string[];
  location?: string;
}

/**
 * POST /api/presentations/assign
 * Backend validates: scheduledAt must be in the future (server time),
 * coordinator course scope, then saves schedule, calendar event, and announcement.
 */
export async function assignPresentationSchedule(
  payload: AssignSchedulePayload
): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl('/api/presentations/assign'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    const msg = err.error || 'Failed to assign presentation schedule';
    throw new Error(err.detail ? `${msg}: ${err.detail}` : msg);
  }
}

/**
 * DELETE /api/presentations/schedule/:groupId
 * Removes a schedule and its linked calendar event.
 */
export async function deletePresentationSchedule(groupId: string): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/presentations/schedule/${groupId}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete presentation schedule');
  }
}

export interface StudentPresentationView {
  group: {
    id: string;
    groupCode: string;
    groupNumber: number | null;
    projectName: string;
  } | null;
  schedule: {
    day: string;
    timeSlot: string;
    scheduledAt: string | null;
    location: string | null;
  } | null;
}

/**
 * Student-only: fetches their group number + assigned presentation time.
 * Calls the backend API which strips supervisor name server-side.
 */
export async function getStudentPresentationView(): Promise<StudentPresentationView> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const response = await apiFetch(apiUrl('/api/presentations/student-view'), {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
    },
  });

  if (!response.ok) {
    console.error('getStudentPresentationView error:', response.status);
    return { group: null, schedule: null };
  }

  return response.json();
}

const SCHEDULE_SELECT = `
  *,
  group:groups!group_id(
    id, group_code, project_name, project_description,
    supervisor:profiles!supervisor_id(id, name),
    members:group_members(student:profiles!student_id(id, name, student_id))
  )
`;

function mapDbPresentationSchedule(data: any): PresentationSchedule {
  const group = data.group;
  return {
    groupId: data.group_id,
    groupName: group?.group_code ?? '',
    students: (group?.members || []).map((m: any) => ({
      id: m.student?.id ?? '',
      name: m.student?.name ?? '',
    })),
    day: data.day,
    timeSlot: data.time_slot,
    projectName: group?.project_name ?? '',
    projectDescription: group?.project_description ?? '',
    committeeMembers: data.committee_members ?? [],
    supervisorName: group?.supervisor?.name ?? undefined,
  };
}

function mapDbPresentationSelection(data: any): StudentPresentationSelection {
  const group = data.group;
  const schedule = data.schedule;
  return {
    groupId: group?.id ?? data.group_id,
    groupName: group?.group_code ?? '',
    students: (group?.members || []).map((m: any) => ({
      id: m.student?.id ?? '',
      name: m.student?.name ?? '',
    })),
    projectName: group?.project_name ?? '',
    projectDescription: group?.project_description ?? '',
    selectedDay: schedule?.day ?? undefined,
    selectedTimeSlot: schedule?.time_slot ?? undefined,
    selectedAt: schedule?.updated_at ?? undefined,
  };
}

export async function getPresentationSchedules(): Promise<PresentationSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('presentation_schedules')
      .select(SCHEDULE_SELECT)
      .order('day');

    if (error) throw error;
    return (data || []).map(mapDbPresentationSchedule);
  } catch (error) {
    console.error('Error fetching presentation schedules:', error);
    return [];
  }
}

export async function getPresentationForGroup(groupId: string): Promise<PresentationSchedule | null> {
  try {
    const { data, error } = await supabase
      .from('presentation_schedules')
      .select(SCHEDULE_SELECT)
      .eq('group_id', groupId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDbPresentationSchedule(data) : null;
  } catch (error) {
    console.error('Error fetching group presentation:', error);
    return null;
  }
}

export async function getStudentPresentationSelections(): Promise<StudentPresentationSelection[]> {
  try {
    // Get all groups with their optional presentation schedule
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select(`
        id, group_code, project_name, project_description,
        members:group_members(student:profiles!student_id(id, name, student_id))
      `)
      .order('group_code');

    if (gError) throw gError;

    // Get all presentation schedules
    const { data: schedules, error: sError } = await supabase
      .from('presentation_schedules')
      .select('*');

    if (sError) throw sError;

    const scheduleMap = new Map<string, any>();
    (schedules || []).forEach((s: any) => scheduleMap.set(s.group_id, s));

    return (groups || []).map((g: any) => {
      const schedule = scheduleMap.get(g.id);
      return mapDbPresentationSelection({ group: g, group_id: g.id, schedule });
    });
  } catch (error) {
    console.error('Error fetching presentation selections:', error);
    return [];
  }
}

export async function updatePresentationSelection(
  groupId: string,
  day: string,
  timeSlot: string
): Promise<void> {
  // Upsert — if schedule exists, update; otherwise create
  const { error } = await supabase
    .from('presentation_schedules')
    .upsert({
      group_id: groupId,
      day,
      time_slot: timeSlot,
      committee_members: [],
    }, { onConflict: 'group_id' });

  if (error) throw error;
}

export async function createPresentationSchedule(schedule: {
  groupId: string;
  day: string;
  timeSlot: string;
  committeeMembers: string[];
}): Promise<void> {
  const { error } = await supabase
    .from('presentation_schedules')
    .upsert({
      group_id: schedule.groupId,
      day: schedule.day,
      time_slot: schedule.timeSlot,
      committee_members: schedule.committeeMembers,
    }, { onConflict: 'group_id' });

  if (error) throw error;
}
