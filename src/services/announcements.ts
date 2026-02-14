import { supabase } from '../lib/supabase';
import type { Announcement, UserRole } from '../types';

function mapDbAnnouncement(data: any): Announcement {
  return {
    id: data.id,
    title: data.title,
    content: data.content,
    author: data.author?.name ?? 'Unknown',
    publishedAt: data.published_at,
    expiresAt: data.expires_at ?? undefined,
    targetRoles: data.target_roles ?? [],
    attachments: data.attachments ?? undefined,
  };
}

export async function getAnnouncementsForRole(role: UserRole): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:profiles!author_id(name)')
      .contains('target_roles', [role])
      .order('published_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbAnnouncement);
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return [];
  }
}

export async function getAllAnnouncements(): Promise<Announcement[]> {
  try {
    const { data, error } = await supabase
      .from('announcements')
      .select('*, author:profiles!author_id(name)')
      .order('published_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbAnnouncement);
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
  const { error } = await supabase.from('announcements').insert({
    title: announcement.title,
    content: announcement.content,
    author_id: announcement.authorId,
    target_roles: announcement.targetRoles,
    expires_at: announcement.expiresAt ?? null,
  });

  if (error) throw error;
}

export async function updateAnnouncement(id: string, updates: {
  title?: string;
  content?: string;
  targetRoles?: UserRole[];
  expiresAt?: string | null;
}): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.content !== undefined) dbUpdates.content = updates.content;
  if (updates.targetRoles !== undefined) dbUpdates.target_roles = updates.targetRoles;
  if (updates.expiresAt !== undefined) dbUpdates.expires_at = updates.expiresAt;

  const { error } = await supabase
    .from('announcements')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
