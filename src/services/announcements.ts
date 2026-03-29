import { supabase } from '../lib/supabase';
import type { Announcement, UserRole } from '../types';

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function getAnnouncementsForRole(role: UserRole, activeRole?: string): Promise<Announcement[]> {
  try {
    const token = await getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    // Send the active role so the backend resolves the correct course scope.
    if (activeRole) headers['X-Active-Role'] = activeRole;
    const res = await fetch(`/api/announcements?role=${encodeURIComponent(role)}`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

export async function getAllAnnouncements(activeRole?: string): Promise<Announcement[]> {
  try {
    const token = await getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (activeRole) headers['X-Active-Role'] = activeRole;
    const res = await fetch('/api/announcements', { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
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
