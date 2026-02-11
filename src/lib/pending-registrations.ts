import { supabase } from './supabase';

export interface PendingRegistration {
  id: string;
  accountType: 'student' | 'supervisor';
  name: string;
  email: string;
  password: string;
  department: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;

  // Student-specific
  studentId?: string;
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

// Get pending registrations only
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

// Add a new registration
export async function addRegistration(
  reg: Omit<PendingRegistration, 'id' | 'status' | 'submittedAt'>
): Promise<void> {
  try {
    // Note: Password will be stored as-is and hashed on the backend when approved
    // This is temporary - ideally the registration should go through a backend endpoint
    const { error } = await supabase.from('pending_registrations').insert({
      account_type: reg.accountType,
      name: reg.name,
      email: reg.email,
      password_hash: reg.password, // TODO: Hash this on backend
      department: reg.department,
      student_id: reg.studentId,
      course: reg.course,
      term: reg.term,
      group_id: reg.groupId,
      project_name: reg.projectName,
      project_idea: reg.projectIdea,
      teammate_submitted_idea: reg.teammateSubmittedIdea,
      employee_number: reg.employeeNumber,
      status: 'pending',
    });

    if (error) throw error;

    notify();
  } catch (error) {
    console.error('Error adding registration:', error);
    throw new Error('Failed to submit registration. Please try again.');
  }
}

// Approve a registration (calls backend API to create auth user)
export async function approveRegistration(id: string): Promise<PendingRegistration | null> {
  try {
    // Get the registration details first
    const { data: registration, error: fetchError } = await supabase
      .from('pending_registrations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!registration) return null;

    // Call backend API to create the user in Supabase Auth
    // This requires the backend to use the service_role key
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/approve-registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
      body: JSON.stringify({ registrationId: id }),
    });

    if (!response.ok) {
      throw new Error('Failed to approve registration');
    }

    notify();

    return mapDatabaseToRegistration(registration);
  } catch (error) {
    console.error('Error approving registration:', error);
    throw new Error('Failed to approve registration. Please try again.');
  }
}

// Reject a registration
export async function rejectRegistration(id: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('pending_registrations')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (error) throw error;

    notify();
  } catch (error) {
    console.error('Error rejecting registration:', error);
    throw new Error('Failed to reject registration. Please try again.');
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
    department: data.department,
    status: data.status,
    submittedAt: data.submitted_at,
    studentId: data.student_id,
    course: data.course,
    term: data.term,
    groupId: data.group_id,
    projectName: data.project_name,
    projectIdea: data.project_idea,
    teammateSubmittedIdea: data.teammate_submitted_idea,
    employeeNumber: data.employee_number,
  };
}
