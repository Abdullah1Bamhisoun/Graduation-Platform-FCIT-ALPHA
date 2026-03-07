import { supabase } from '../lib/supabase';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'deadline' | 'demo' | 'presentation' | 'meeting';
  time?: string;
  location?: string;
  courseId?: string;
}

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function getCalendarEvents(): Promise<CalendarEvent[]> {
  try {
    const token = await getToken();
    const res = await fetch('/api/calendar-events', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for calendar events');
    try {
      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .order('date', { ascending: true });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title,
        date: row.date,
        type: row.type,
        time: row.time ?? undefined,
        location: row.location ?? undefined,
        courseId: row.course_id ?? undefined,
      }));
    } catch (sbError) {
      console.error('Supabase fallback failed for calendar events:', sbError);
      return [];
    }
  }
}

export async function createCalendarEvent(event: {
  title: string;
  date: string;
  type: CalendarEvent['type'];
  time?: string;
  location?: string;
}): Promise<string> {
  const token = await getToken();
  const res = await fetch('/api/calendar-events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(event),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to create calendar event');
  }
  const data = await res.json();
  return data.id;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/calendar-events/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete calendar event');
  }
}
