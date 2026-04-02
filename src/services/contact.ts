import { supabase } from '../lib/supabase';
import { apiUrl } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoordinatorContact {
  courseId: string;
  courseCode: string;
  courseName: string;
  coordinatorId: string | null;
  coordinatorEmail: string | null;
  coordinatorName: string | null;
  phone: string | null;
  customName: string | null;
}

export interface SupportInfo {
  id: string | null;
  supportEmail: string;
  phone: string | null;
  description: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function authHeaders(token: string, activeRole?: string): Record<string, string> {
  const h: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (activeRole) h['X-Active-Role'] = activeRole;
  return h;
}

// ─── Coordinator Contacts ─────────────────────────────────────────────────────

export async function getCoordinatorContacts(activeRole?: string): Promise<CoordinatorContact[]> {
  try {
    const token = await getToken();
    const res = await fetch(apiUrl('/api/contact/coordinators'), {
      headers: authHeaders(token, activeRole),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching coordinator contacts:', error);
    return [];
  }
}

export async function upsertCoordinatorContact(
  courseId: string,
  data: { phone?: string | null; customName?: string | null },
  activeRole?: string
): Promise<void> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/contact/coordinators/${courseId}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token, activeRole) },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to save coordinator contact');
  }
}

export async function deleteCoordinatorContact(courseId: string, activeRole?: string): Promise<void> {
  const token = await getToken();
  const res = await fetch(apiUrl(`/api/contact/coordinators/${courseId}`), {
    method: 'DELETE',
    headers: authHeaders(token, activeRole),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to remove coordinator contact');
  }
}

// ─── Support Info ─────────────────────────────────────────────────────────────

export async function getSupportInfo(activeRole?: string): Promise<SupportInfo | null> {
  try {
    const token = await getToken();
    const res = await fetch(apiUrl('/api/contact/support'), {
      headers: authHeaders(token, activeRole),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error('Error fetching support info:', error);
    return null;
  }
}

export async function upsertSupportInfo(
  data: { supportEmail: string; phone?: string | null; description?: string | null },
  activeRole?: string
): Promise<void> {
  const token = await getToken();
  const res = await fetch(apiUrl('/api/contact/support'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders(token, activeRole) },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to save support info');
  }
}
