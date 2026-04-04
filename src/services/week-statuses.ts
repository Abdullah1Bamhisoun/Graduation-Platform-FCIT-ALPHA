import { supabase } from '../lib/supabase';
import type { WeekStatus, WeekDisplayStatus } from '../types';

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

/**
 * Derives the human-readable status from flags and/or deadline window.
 *
 * Priority:
 * 1. Locked (permanent)
 * 2. Datetime window (open_at / close_at) — if both are set, they drive status
 * 3. Manual is_open flag (legacy toggle)
 * 4. Not Opened
 */
export function getDisplayStatus(ws: WeekStatus): WeekDisplayStatus {
  if (ws.isLocked) return 'Locked';

  if (ws.openAt && ws.closeAt) {
    const now     = new Date();
    const openAt  = new Date(ws.openAt);
    const closeAt = new Date(ws.closeAt);
    if (now < openAt)   return 'Upcoming';
    if (now <= closeAt) return 'Open';
    return 'Closed';
  }

  if (ws.isOpen)                  return 'Open';
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
 * Seeds missing week rows for a course type (weeks 1–16).
 * Best-effort — silently ignores errors if RLS prevents insertion.
 */
async function ensureSeeded(courseType: '498' | '499'): Promise<void> {
  const { data: existing } = await supabase
    .from('week_statuses')
    .select('week_number')
    .eq('course_type', courseType);

  const existingNums = new Set((existing || []).map((r: any) => r.week_number));
  const missing = Array.from({ length: 16 }, (_, i) => i + 1).filter((n) => !existingNums.has(n));

  if (missing.length === 0) return;

  const rows = missing.map((n) => ({
    course_type: courseType,
    week_number: n,
    is_open:     false,
    was_opened:  false,
  }));

  // Best-effort — ignore errors (e.g. RLS may prevent this for non-admin users)
  await supabase.from('week_statuses').insert(rows);
}

/**
 * Fetch all 16 week statuses for a course type. Auto-seeds rows on first access.
 */
export async function getWeekStatuses(
  courseType: '498' | '499',
  _semester?: string,
  _department?: string
): Promise<WeekStatus[]> {
  await ensureSeeded(courseType);

  const { data, error } = await supabase
    .from('week_statuses')
    .select('*')
    .eq('course_type', courseType)
    .order('week_number');

  if (error) throw new Error(error.message || 'Failed to fetch week statuses');
  return (data || []).map(mapRow);
}

/** Open a week (sets is_open = true, was_opened = true). */
export async function openWeek(
  weekStatusId: string,
  openedBy?: string
): Promise<void> {
  const { error } = await supabase
    .from('week_statuses')
    .update({ is_open: true, was_opened: true, updated_by: openedBy ?? null })
    .eq('id', weekStatusId);

  if (error) throw new Error(error.message || 'Failed to open week');
}

/** Close a week (sets is_open = false). Cannot close a locked week. */
export async function closeWeek(weekStatusId: string): Promise<void> {
  const { data: row, error: readErr } = await supabase
    .from('week_statuses')
    .select('is_locked')
    .eq('id', weekStatusId)
    .single();

  if (readErr) throw new Error(readErr.message || 'Failed to fetch week status');
  if ((row as any)?.is_locked) throw new Error('Cannot close a locked week.');

  const { error } = await supabase
    .from('week_statuses')
    .update({ is_open: false })
    .eq('id', weekStatusId);

  if (error) throw new Error(error.message || 'Failed to close week');
}

/** Lock a week permanently (must have been opened before). */
export async function lockWeek(weekStatusId: string): Promise<void> {
  const { data, error: readErr } = await supabase
    .from('week_statuses')
    .select('was_opened')
    .eq('id', weekStatusId)
    .single();

  if (readErr) throw new Error(readErr.message || 'Failed to fetch week status');
  if (!(data as any)?.was_opened) throw new Error('Cannot lock a week that was never opened.');

  const { error } = await supabase
    .from('week_statuses')
    .update({ is_open: false, is_locked: true })
    .eq('id', weekStatusId);

  if (error) throw new Error(error.message || 'Failed to lock week');
}

/**
 * Set open_at / close_at for a week's submission window.
 * Pass null for either field to clear it.
 */
export async function setWeekDeadline(
  weekStatusId: string,
  openAt: string | null,
  closeAt: string | null
): Promise<void> {
  if (!openAt && !closeAt) throw new Error('Provide at least one of open_at or close_at.');
  if (openAt && closeAt && new Date(openAt) >= new Date(closeAt)) {
    throw new Error('open_at must be before close_at.');
  }

  const payload: Record<string, string | null> = {};
  if (openAt  !== undefined) payload.open_at  = openAt;
  if (closeAt !== undefined) payload.close_at = closeAt;

  const { error } = await supabase
    .from('week_statuses')
    .update(payload)
    .eq('id', weekStatusId);

  if (error) throw new Error(error.message || 'Failed to set deadline');
}

/** Returns the number of weeks that were opened (for grade calculation). */
export function countOpenedWeeks(statuses: WeekStatus[]): number {
  return statuses.filter(ws => ws.wasOpened).length;
}
