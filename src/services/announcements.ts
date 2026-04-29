import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import type { Announcement, UserRole } from '../types';

// ─── Module-level cache ───────────────────────────────────────────────────────

const ANNOUNCEMENTS_CACHE_TTL = 30 * 1000; // 30 seconds

interface CacheEntry { data: Announcement[]; fetchedAt: number }

const _cache = new Map<string, CacheEntry>();

function _isFresh(entry: CacheEntry | undefined): entry is CacheEntry {
  return !!entry && Date.now() - entry.fetchedAt < ANNOUNCEMENTS_CACHE_TTL;
}

export function clearAnnouncementsCache() {
  _cache.clear();
}

// ─── Token helper ─────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function getAnnouncementsForRole(role: UserRole, activeRole?: string): Promise<Announcement[]> {
  const key = `role:${role}:${activeRole ?? ''}`;
  const cached = _cache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const token = await getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    // Send the active role so the backend resolves the correct course scope.
    if (activeRole) headers['X-Active-Role'] = activeRole;
    const res = await apiFetch(apiUrl(`/api/announcements?role=${encodeURIComponent(role)}`), { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: Announcement[] = await res.json();
    _cache.set(key, { data, fetchedAt: Date.now() });
    return data;
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

export async function getAllAnnouncements(activeRole?: string): Promise<Announcement[]> {
  const key = `all:${activeRole ?? ''}`;
  const cached = _cache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const token = await getToken();
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (activeRole) headers['X-Active-Role'] = activeRole;
    const res = await apiFetch(apiUrl('/api/announcements'), { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: Announcement[] = await res.json();
    _cache.set(key, { data, fetchedAt: Date.now() });
    return data;
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
  groupId?: string;
  scheduledFor?: string;
}): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl('/api/announcements'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      title:        announcement.title,
      content:      announcement.content,
      targetRoles:  announcement.targetRoles,
      expiresAt:    announcement.expiresAt ?? null,
      groupId:      announcement.groupId ?? null,
      scheduledFor: announcement.scheduledFor ?? null,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to create announcement');
  }
  clearAnnouncementsCache();
}

export async function updateAnnouncement(id: string, updates: {
  title?: string;
  content?: string;
  targetRoles?: UserRole[];
  expiresAt?: string | null;
}): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/announcements/${id}`), {
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
  clearAnnouncementsCache();
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const token = await getToken();
  const res = await apiFetch(apiUrl(`/api/announcements/${id}`), {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete announcement');
  }
  clearAnnouncementsCache();
}
