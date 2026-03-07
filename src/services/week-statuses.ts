import { supabase } from '../lib/supabase';
import type { WeekStatus, WeekDisplayStatus } from '../types';

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

/**
 * Maps a raw DB row to the WeekStatus interface.
 * Handles the minimal real schema (course_type, week_number, is_open,
 * was_opened, updated_by, updated_at) plus optional extra columns.
 */
function mapRow(row: any): WeekStatus {
  return {
    id:         row.id,
    department: row.department  ?? 'IS',
    courseType: (row.course_type ?? '498') as '498' | '499',
    weekNumber: row.week_number,
    isOpen:     row.is_open     ?? false,
    isLocked:   row.is_locked   ?? false,
    wasOpened:  row.was_opened  ?? false,
    semester:   row.semester    ?? 'DEFAULT',
    openedAt:   row.opened_at   ?? undefined,
    closedAt:   row.closed_at   ?? undefined,
    lockedAt:   row.locked_at   ?? undefined,
    openedBy:   row.updated_by  ?? row.opened_by ?? undefined,
  };
}

/** Derives the human-readable status from flags. */
export function getDisplayStatus(ws: WeekStatus): WeekDisplayStatus {
  if (ws.isLocked)                return 'Locked';
  if (ws.isOpen)                  return 'Open';
  if (ws.wasOpened && !ws.isOpen) return 'Closed';
  return 'Not Opened';
}

/**
 * Fetch all 16 week statuses via the server API (bypasses RLS, auto-seeds).
 * The semester and department params are accepted for API compatibility but
 * are not sent to the server — the DB currently filters by course_type only.
 */
export async function getWeekStatuses(
  courseType: '498' | '499',
  _semester?: string,
  _department?: string
): Promise<WeekStatus[]> {
  try {
    const token = await getToken();
    const res = await fetch(`/api/week-statuses?courseType=${courseType}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || body.message || `Failed to fetch week statuses: HTTP ${res.status}`);
    }
    const rows: any[] = await res.json();
    return rows.map(mapRow);
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for week statuses');
    try {
      const { data, error } = await supabase
        .from('week_statuses')
        .select('*')
        .eq('course_type', courseType)
        .order('week_number', { ascending: true });
      if (error) throw error;
      return (data || []).map(mapRow);
    } catch (sbError) {
      console.error('Supabase fallback failed for week statuses:', sbError);
      return [];
    }
  }
}

/** Open a week (sets is_open = true, was_opened = true). */
export async function openWeek(
  weekStatusId: string,
  _openedBy?: string
): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/week-statuses/${weekStatusId}/open`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to open week: HTTP ${res.status}`);
  }
}

/** Close a week (sets is_open = false). Cannot close a locked week. */
export async function closeWeek(weekStatusId: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/week-statuses/${weekStatusId}/close`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to close week: HTTP ${res.status}`);
  }
}

/** Lock a week permanently (must have been opened before). */
export async function lockWeek(weekStatusId: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/week-statuses/${weekStatusId}/lock`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to lock week: HTTP ${res.status}`);
  }
}

/** Returns the number of weeks that were opened (for grade calculation). */
export function countOpenedWeeks(statuses: WeekStatus[]): number {
  return statuses.filter(ws => ws.wasOpened).length;
}
