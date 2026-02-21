import { supabase } from '../lib/supabase';
import type { UserRole, UserRoleEntry } from '../types';

/**
 * Load all role entries for a user from the user_roles table.
 * Returns an array of UserRoleEntry objects (role name + optional coordinator course).
 */
export async function getUserRoles(userId: string): Promise<UserRoleEntry[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select(`
      id,
      coordinator_course_id,
      roles ( id, name )
    `)
    .eq('user_id', userId);

  if (error) {
    console.error('Error loading user_roles:', error.message);
    return [];
  }

  return (data || []).map((row: any) => ({
    roleId: row.roles?.id ?? row.id,
    roleName: (row.roles?.name ?? 'student') as UserRole,
    coordinatorCourseId: row.coordinator_course_id ?? undefined,
  }));
}

/**
 * Log a role switch via the backend API (stores in role_switch_logs).
 * Fails silently so it never blocks the UI.
 */
export async function logRoleSwitch(
  fromRole: UserRole,
  toRole: UserRole
): Promise<void> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    if (!token) return;

    await fetch('/api/roles/switch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ fromRole, toRole }),
    });
  } catch (err) {
    console.error('Failed to log role switch:', err);
  }
}

// ── localStorage key helpers ─────────────────────────────────────────────────

const ACTIVE_ROLE_KEY = (userId: string) => `activeRole_${userId}`;

export function getStoredActiveRole(userId: string): UserRole | null {
  try {
    return (localStorage.getItem(ACTIVE_ROLE_KEY(userId)) as UserRole) || null;
  } catch {
    return null;
  }
}

export function storeActiveRole(userId: string, role: UserRole): void {
  try {
    localStorage.setItem(ACTIVE_ROLE_KEY(userId), role);
  } catch {
    // ignore storage errors
  }
}

export function clearStoredActiveRole(userId: string): void {
  try {
    localStorage.removeItem(ACTIVE_ROLE_KEY(userId));
  } catch {
    // ignore
  }
}

/**
 * Derive which dashboard path a user should land on based on their active role.
 */
export function getDashboardPath(activeRole: UserRole): string {
  switch (activeRole) {
    case 'admin':       return '/admin';
    case 'coordinator': return '/coordinator';
    case 'supervisor':  return '/supervisor';
    case 'student':     return '/student';
    default:            return '/login';
  }
}
