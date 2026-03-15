import { supabase } from './supabase';

export interface PendingRegistration {
  id: string;
  accountType: 'student' | 'supervisor';
  name: string;
  email: string;
  password?: string;
  department: string;
  gender?: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;

  // Student-specific
  studentId?: string;
  /** UUID of the selected course (new scalable FK) */
  courseId?: string;
  /** Human-readable course code e.g. 'CPIS-498' (for display) */
  course?: string;
  term?: string;
  groupId?: string;
  projectName?: string;
  projectIdea?: string;
  teammateSubmittedIdea?: boolean;

  // Supervisor-specific
  employeeNumber?: string;
}

// Listeners for reactivity
type Listener = () => void;
const listeners: Listener[] = [];

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribe(listener: Listener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx > -1) listeners.splice(idx, 1);
  };
}

// Get all registrations (admin only)
export async function getRegistrations(): Promise<PendingRegistration[]> {
  try {
    const { data, error } = await supabase
      .from('pending_registrations')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDatabaseToRegistration);
  } catch (error) {
    console.error('Error fetching registrations:', error);
    return [];
  }
}

// Get pending registrations only (direct Supabase query — subject to RLS)
export async function getPendingRegistrations(): Promise<PendingRegistration[]> {
  try {
    const { data, error } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(mapDatabaseToRegistration);
  } catch (error) {
    console.error('Error fetching pending registrations:', error);
    return [];
  }
}

/**
 * Fetch pending registrations via the backend API.
 * Passes X-Active-Role so the server applies coordinator-scoped filtering
 * (only the coordinator's course students + all supervisors).
 * Admins receive all registrations.
 */
export async function getPendingRegistrationsViaAPI(activeRole?: string): Promise<PendingRegistration[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return [];

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
    };
    if (activeRole) headers['X-Active-Role'] = activeRole;

    const response = await fetch('/api/auth/pending-registrations?status=pending', { headers });
    if (!response.ok) return [];

    const rows = await response.json();
    return (rows || []).map(mapDatabaseToRegistration);
  } catch (error) {
    console.error('Error fetching pending registrations via API:', error);
    return [];
  }
}

// Add a new registration
export async function addRegistration(
  reg: Omit<PendingRegistration, 'id' | 'status' | 'submittedAt'>
): Promise<void> {
  try {
    const response = await fetch('/api/auth/submit-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountType: reg.accountType,
        name: reg.name,
        email: reg.email,
        department: reg.department || null,
        gender: reg.gender || null,
        studentId: reg.studentId,
        courseId: reg.courseId || null,
        course: reg.course,
        term: reg.term,
        groupId: reg.groupId,
        projectName: reg.projectName,
        projectIdea: reg.projectIdea,
        teammateSubmittedIdea: reg.teammateSubmittedIdea,
        employeeNumber: reg.employeeNumber,
      }),
    });

    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Failed to submit registration');

    notify();
  } catch (error: any) {
    console.error('Error adding registration:', error);
    throw new Error(error?.message || 'Failed to submit registration. Please try again.');
  }
}

// Approve a registration (calls backend API to create auth user)
export async function approveRegistration(id: string, activeRole?: string): Promise<void> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    if (activeRole) headers['X-Active-Role'] = activeRole;

    const response = await fetch('/api/auth/approve-registration', {
      method: 'POST',
      headers,
      body: JSON.stringify({ registrationId: id }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((json as any).error || 'Failed to approve registration');

    notify();
  } catch (error: any) {
    console.error('Error approving registration:', error);
    throw new Error(error?.message || 'Failed to approve registration. Please try again.');
  }
}

// Reject a registration (routes through backend to bypass RLS)
export async function rejectRegistration(id: string): Promise<void> {
  try {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const response = await fetch('/api/auth/reject-registration', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ registrationId: id }),
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error((json as any).error || 'Rejection failed');

    notify();
  } catch (error: any) {
    console.error('Error rejecting registration:', error);
    throw new Error(error?.message || 'Failed to reject registration. Please try again.');
  }
}

// Helper function to map database row to PendingRegistration
function mapDatabaseToRegistration(data: any): PendingRegistration {
  return {
    id: data.id,
    accountType: data.account_type,
    name: data.name,
    email: data.email,
    password: '', // Don't expose the password hash
    department: data.department ?? '',
    gender: data.gender,
    status: data.status,
    submittedAt: data.submitted_at,
    studentId: data.student_id,
    courseId: data.course_id ?? undefined,
    course: data.course,
    term: data.term,
    groupId: data.group_id,
    projectName: data.project_name,
    projectIdea: data.project_idea,
    teammateSubmittedIdea: data.teammate_submitted_idea,
    employeeNumber: data.employee_number,
  };
}
