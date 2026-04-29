import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '../lib/api';
import type { WeekStatus, WeekDisplayStatus } from '../types';

// ─── Module-level cache ───────────────────────────────────────────────────────

const WEEK_STATUS_CACHE_TTL = 60 * 1000; // 1 minute

interface CacheEntry { data: WeekStatus[]; fetchedAt: number }

const _cache = new Map<string, CacheEntry>();

function _isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && Date.now() - entry.fetchedAt < WEEK_STATUS_CACHE_TTL;
}

export function clearWeekStatusesCache() {
  _cache.clear();
}

/**
 * Maps a raw DB row to the WeekStatus interface.
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
    openAt:     row.open_at     ?? undefined,
    closeAt:    row.close_at    ?? undefined,
  };
}

/** Get the Bearer token from the current Supabase session. */
async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

/** Shared helper: throw on non-OK responses. */
async function checkResponse(res: Response, fallback: string): Promise<void> {
  if (!res.ok) {
    let msg = fallback;
    try { msg = (await res.json())?.error ?? fallback; } catch {}
    throw new Error(msg);
  }
}

/**
 * Derives the human-readable status from flags and/or deadline window.
 *
 * Priority:
 * 1. Locked (permanent)
 * 2. Manual is_open flag (always wins over datetime window)
 * 3. Datetime window (open_at / close_at) — drives Upcoming / Open / Closed
 * 4. Not Opened
 */
export function getDisplayStatus(ws: WeekStatus): WeekDisplayStatus {
  if (ws.isLocked) return 'Locked';

  // Datetime window takes priority when both open_at and close_at are set
  if (ws.openAt && ws.closeAt) {
    const now     = new Date();
    const openAt  = new Date(ws.openAt);
    const closeAt = new Date(ws.closeAt);
    if (now < openAt)   return 'Upcoming';
    if (now <= closeAt) return 'Open';
    return 'Closed';
  }

  // Fall back to manual is_open flag
  if (ws.isOpen) return 'Open';

  if (ws.wasOpened && !ws.isOpen) return 'Closed';
  return 'Not Opened';
}

/**
 * Returns true if the student can submit during this week's window.
 * Respects datetime window when configured, falls back to is_open flag.
 */
export function isSubmissionOpen(ws: WeekStatus | undefined): boolean {
  if (!ws || ws.isLocked) return false;
  if (ws.openAt && ws.closeAt) {
    const now = new Date();
    return now >= new Date(ws.openAt) && now <= new Date(ws.closeAt);
  }
  return ws.isOpen;
}

/**
 * Fetch all 16 week statuses for a course type via the server API.
 * Server uses supabaseAdmin so RLS is bypassed.
 */
export async function getWeekStatuses(
  courseType: '498' | '499',
  _semester?: string,
  _department?: string
): Promise<WeekStatus[]> {
  const cached = _cache.get(courseType);
  if (_isFresh(cached)) return cached.data;

  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/week-statuses?courseType=${courseType}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res, 'Failed to fetch week statuses');
  const raw = await res.json();
  const data = (raw || []).map(mapRow);
  _cache.set(courseType, { data, fetchedAt: Date.now() });
  return data;
}

/** Open a week (sets is_open = true, was_opened = true). */
export async function openWeek(
  weekStatusId: string,
  _openedBy?: string,
  courseId?: string
): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/week-statuses/${weekStatusId}/open`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: courseId ? JSON.stringify({ courseId }) : undefined,
  });
  await checkResponse(res, 'Failed to open week');
  clearWeekStatusesCache();
}

/** Close a week (sets is_open = false). Cannot close a locked week. */
export async function closeWeek(weekStatusId: string): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/week-statuses/${weekStatusId}/close`), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res, 'Failed to close week');
  clearWeekStatusesCache();
}

/** Lock a week permanently (must have been opened before). */
export async function lockWeek(weekStatusId: string): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/week-statuses/${weekStatusId}/lock`), {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });
  await checkResponse(res, 'Failed to lock week');
  clearWeekStatusesCache();
}

/**
 * Set open_at / close_at for a week's submission window.
 * Pass null for either field to clear it.
 */
export async function setWeekDeadline(
  weekStatusId: string,
  openAt: string | null,
  closeAt: string | null,
  courseId?: string
): Promise<void> {
  if (openAt && closeAt && new Date(openAt) >= new Date(closeAt)) {
    throw new Error('open_at must be before close_at.');
  }

  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/week-statuses/${weekStatusId}/deadline`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ open_at: openAt, close_at: closeAt, courseId: courseId ?? null }),
  });
  await checkResponse(res, 'Failed to set deadline');
  clearWeekStatusesCache();
}

/** Returns the number of weeks that were opened (for grade calculation). */
export function countOpenedWeeks(statuses: WeekStatus[]): number {
  return statuses.filter(ws => ws.wasOpened).length;
}
