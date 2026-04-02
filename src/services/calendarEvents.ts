import { supabase } from '../lib/supabase';
import { apiUrl } from '@/lib/api';

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
    const res = await fetch(apiUrl('/api/calendar-events'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
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
}): Promise<string> {
  const token = await getToken();
  const res = await fetch(apiUrl('/api/calendar-events'), {
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
  const res = await fetch(apiUrl(`/api/calendar-events/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete calendar event');
  }
}
