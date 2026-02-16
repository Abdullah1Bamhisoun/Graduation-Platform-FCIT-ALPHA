import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

async function getAdminToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

export async function getProfilesByRole(role: UserRole): Promise<User[]> {
  try {
    const token = await getAdminToken();
    const res = await fetch(`/api/users?role=${encodeURIComponent(role)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

export async function getProfileById(id: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? mapDbProfile(data) : null;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
}

export async function updateProfile(id: string, updates: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
}
