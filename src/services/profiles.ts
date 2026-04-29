import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import type { User, UserRole } from '../types';

// ── Module-level TTL cache ──────────────────────────────────────────────────
const PROFILES_CACHE_TTL = 60 * 1000; // 1 minute
interface CacheEntry<T> { data: T; fetchedAt: number }
const _byRoleCache = new Map<UserRole, CacheEntry<User[]>>();
const _byIdCache = new Map<string, CacheEntry<User | null>>();

function _isFresh<T>(e?: CacheEntry<T>): e is CacheEntry<T> {
  return !!e && Date.now() - e.fetchedAt < PROFILES_CACHE_TTL;
}

export function clearProfilesCache() {
  _byRoleCache.clear();
  _byIdCache.clear();
}

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
  const cached = _byRoleCache.get(role);
  if (_isFresh(cached)) return cached.data;

  try {
    const token = await getAdminToken();
    const res = await apiFetch(apiUrl(`/api/users?role=${encodeURIComponent(role)}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const result = await res.json();
    _byRoleCache.set(role, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }
}

export async function getProfileById(id: string): Promise<User | null> {
  const cached = _byIdCache.get(id);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    const result = data ? mapDbProfile(data) : null;
    _byIdCache.set(id, { data: result, fetchedAt: Date.now() });
    return result;
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
  clearProfilesCache();
}
