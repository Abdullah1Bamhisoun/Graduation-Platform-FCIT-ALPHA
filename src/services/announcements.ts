import { supabase } from '../lib/supabase';
import type { Announcement, UserRole } from '../types';

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function mapDbAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    authorId: row.author_id,
    targetRoles: row.target_roles ?? [],
    expiresAt: row.expires_at ?? undefined,
    createdAt: row.created_at,
  } as Announcement;
}

export async function getAnnouncementsForRole(role: UserRole): Promise<Announcement[]> {
  try {
    const token = await getToken();
    const res = await fetch(`/api/announcements?role=${encodeURIComponent(role)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for announcements');
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .contains('target_roles', [role])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDbAnnouncement);
    } catch (sbError) {
      console.error('Supabase fallback failed for announcements:', sbError);
      return [];
    }
  }
}

export async function getAllAnnouncements(): Promise<Announcement[]> {
  try {
    const token = await getToken();
    const res = await fetch('/api/announcements', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for all announcements');
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(mapDbAnnouncement);
    } catch (sbError) {
      console.error('Supabase fallback failed for announcements:', sbError);
      return [];
    }
  }
}

export async function createAnnouncement(announcement: {
  title: string;
  content: string;
  authorId: string;
  targetRoles: UserRole[];
  expiresAt?: string;
}): Promise<void> {
  const token = await getToken();
  const res = await fetch('/api/announcements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: announcement.title,
      content: announcement.content,
      targetRoles: announcement.targetRoles,
      expiresAt: announcement.expiresAt ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to create announcement');
  }
}

export async function updateAnnouncement(id: string, updates: {
  title?: string;
  content?: string;
  targetRoles?: UserRole[];
  expiresAt?: string | null;
}): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/announcements/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title: updates.title,
      content: updates.content,
      targetRoles: updates.targetRoles,
      expiresAt: updates.expiresAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to update announcement');
  }
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(`/api/announcements/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete announcement');
  }
}
