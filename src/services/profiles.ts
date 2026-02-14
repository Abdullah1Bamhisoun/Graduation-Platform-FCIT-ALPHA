import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

function mapDbProfile(data: any): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role as UserRole,
    studentId: data.student_id ?? undefined,
    employeeNumber: data.employee_number ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
  };
}

export async function getProfilesByRole(role: UserRole): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', role)
      .order('name');

    if (error) throw error;
    return (data || []).map(mapDbProfile);
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
