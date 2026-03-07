import { supabase } from '../lib/supabase';
import type { User, UserRole } from '../types';

function mapDbProfile(data: any): User {
  return {
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role,
    roles: data.roles ?? [data.role],
    activeRole: data.activeRole ?? data.role,
    studentId: data.student_id ?? undefined,
    employeeNumber: data.employee_number ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
    department: data.department ?? undefined,
    gender: data.gender ?? undefined,
  };
}

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
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for profiles by role');
    try {
      // Look up the role id, then get user_ids from user_roles, then fetch profiles
      const { data: roleRow } = await supabase
        .from('roles')
        .select('id')
        .eq('name', role)
        .maybeSingle();
      if (!roleRow) return [];
      const { data: userRoles, error: urError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role_id', roleRow.id);
      if (urError) throw urError;
      const userIds = (userRoles || []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds);
      if (pError) throw pError;
      return (profiles || []).map((p: any) => mapDbProfile({ ...p, role }));
    } catch (sbError) {
      console.error('Supabase fallback failed for profiles by role:', sbError);
      return [];
    }
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
