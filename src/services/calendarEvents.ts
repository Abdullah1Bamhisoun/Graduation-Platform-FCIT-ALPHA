import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'demo' | 'presentation' | 'meeting';
  time?: string;
  location?: string;
  courseId?: string;
  groupId?: string;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

const CALENDAR_CACHE_TTL = 2 * 60 * 1000; // 2 minutes

interface CacheEntry { data: CalendarEvent[]; fetchedAt: number }

let _cache: CacheEntry | null = null;

function _isFresh(): boolean {
  return !!_cache && Date.now() - _cache.fetchedAt < CALENDAR_CACHE_TTL;
}

export function clearCalendarEventsCache() {
  _cache = null;
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  if (_isFresh()) return _cache!.data;

  try {
    const token = await getToken();
    const res = await apiFetch(apiUrl('/api/calendar-events'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: CalendarEvent[] = await res.json();
    _cache = { data, fetchedAt: Date.now() };
    return data;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

export async function createCalendarEvent(event: {
  title: string;
  date: string;
  type: CalendarEvent['type'];
  time?: string;
  location?: string;
  groupId?: string;
}): Promise<string> {
  const token = await getToken();
  const res = await apiFetch(apiUrl('/api/calendar-events'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to create calendar event');
  }
  const data = await res.json();
  clearCalendarEventsCache();
  return data.id;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/calendar-events/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete calendar event');
  }
  clearCalendarEventsCache();
}
