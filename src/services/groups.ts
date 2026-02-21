import { supabase } from '../lib/supabase';
import { mapCourseCode } from './mappers';

export interface GroupData {
  id: string;
  groupCode: string;
  groupNumber: number | null;
  courseId: string;
  courseCode: string;
  projectName: string;
  projectDescription: string;
  supervisorId: string;
  supervisorName: string;
  isLocked: boolean;
  status: 'pending' | 'approved' | 'rejected';
  department: string | null;
  gender: string | null;
  courseNumber: string | null;
  members: { id: string; name: string; studentId?: string }[];
  membersCount: number;
}

/** Lightweight shape used on the Register page */
export interface PublicGroup {
  id: string;
  groupNumber: number;
  department: string | null;
  projectName: string | null;
  isLocked: boolean;
  status: 'pending' | 'approved' | 'rejected';
  gender: string | null;
  courseNumber: string | null;
  membersCount: number;
}

function mapDbGroup(data: any): GroupData {
  return {
    id: data.id,
    groupCode: data.group_code,
    groupNumber: data.group_number ?? null,
    courseId: data.course_id ?? '',
    courseCode: data.course ? mapCourseCode(data.course.code) : (data.courseCode ?? ''),
    projectName: data.project_name ?? data.projectName ?? '',
    projectDescription: data.project_description ?? data.projectDescription ?? '',
    supervisorId: data.supervisor_id ?? data.supervisorId ?? '',
    supervisorName: data.supervisor?.name ?? data.supervisorName ?? '',
    isLocked: data.is_locked ?? data.isLocked ?? false,
    status: data.status ?? 'pending',
    department: data.department ?? null,
    gender: data.gender ?? null,
    courseNumber: data.course_number ?? data.courseNumber ?? null,
    members: (data.members || []).map((m: any) => ({
      id: m.student?.id ?? m.student_id ?? m.id,
      name: m.student?.name ?? m.name ?? '',
      studentId: m.student?.student_id ?? m.studentId ?? undefined,
    })),
    membersCount: (data.members || []).length,
  };
}

/** Fetch all groups via backend API (bypasses RLS).
 *  Passing activeRole ensures the backend applies coordinator course-scoping when needed. */
async function fetchAllGroupsFromApi(activeRole?: string): Promise<GroupData[]> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const headers: Record<string, string> = { Authorization: `Bearer ${token ?? ''}` };
  if (activeRole) headers['X-Active-Role'] = activeRole;
  const response = await fetch('/api/groups', { headers });
  if (!response.ok) {
    const text = await response.text();
    console.error('getAllGroups API error', response.status, text);
    throw new Error(`Failed to fetch groups (${response.status})`);
  }
  const data = await response.json();
  return (data as any[]).map((g) => mapDbGroup({
    ...g,
    group_code: g.groupCode,
    group_number: g.groupNumber,
    project_name: g.projectName,
    project_description: g.projectDescription,
    supervisor_id: g.supervisorId,
    is_locked: g.isLocked,
    course_number: g.courseNumber,
    course_id: g.courseId,       // backend now returns courseId (camelCase)
  }));
}

const GROUP_SELECT = `
  *,
  supervisor:profiles!supervisor_id(id, name),
  members:group_members(student_id, student:profiles!student_id(id, name, student_id)),
  course:courses(code, name)
`;

export async function getGroupsForSupervisor(supervisorId: string): Promise<GroupData[]> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('supervisor_id', supervisorId)
      .order('group_number', { ascending: true });

    if (error) throw error;
    return (data || []).map(mapDbGroup);
  } catch (error) {
    console.error('Error fetching supervisor groups:', error);
    return [];
  }
}

export async function getGroupForStudent(studentId: string): Promise<GroupData | null> {
  try {
    // Step 1: find the group this student belongs to
    const { data: membership, error: memError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    if (memError) throw memError;
    if (!membership) return null;

    const groupId = membership.group_id;

    // Step 2: fetch the group row (flat, no FK joins for members)
    const { data: groupRow, error: groupError } = await supabase
      .from('groups')
      .select('id, group_code, group_number, department, gender, course_number, project_name, project_description, is_locked, status, created_at, supervisor_id')
      .eq('id', groupId)
      .single();

    if (groupError) throw groupError;
    if (!groupRow) return null;

    // Step 3: fetch all members of this group
    const { data: memberRows } = await supabase
      .from('group_members')
      .select('student_id')
      .eq('group_id', groupId);

    const memberIds = (memberRows || []).map((m: any) => m.student_id);
    const profileIds = [...new Set([...memberIds, groupRow.supervisor_id].filter(Boolean))];

    // Step 4: batch-fetch profiles
    let profileMap: Record<string, { id: string; name: string; student_id?: string }> = {};
    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, student_id')
        .in('id', profileIds);
      for (const p of (profiles || [])) {
        profileMap[p.id] = p;
      }
    }

    const supervisor = groupRow.supervisor_id ? profileMap[groupRow.supervisor_id] : null;

    return mapDbGroup({
      ...groupRow,
      supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
      members: memberIds.map((id: string) => ({
        student_id: id,
        student: profileMap[id] ? { id, name: profileMap[id].name, student_id: profileMap[id].student_id } : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching student group:', error);
    return null;
  }
}

export async function getAllGroups(activeRole?: string): Promise<GroupData[]> {
  try {
    return await fetchAllGroupsFromApi(activeRole);
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
}

export async function getGroupById(id: string): Promise<GroupData | null> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? mapDbGroup(data) : null;
  } catch (error) {
    console.error('Error fetching group:', error);
    return null;
  }
}

/**
 * Used by the registration page — public, no auth required.
 * Filters by course_id (preferred, scalable) with optional legacy fallbacks.
 */
export async function getPublicGroups(
  department?: string,
  courseNumber?: string,
  gender?: string,
  courseId?: string,
): Promise<PublicGroup[]> {
  try {
    const params = new URLSearchParams();
    if (courseId)     params.set('course_id',    courseId);
    if (department)   params.set('department',   department);
    if (courseNumber) params.set('course_number', courseNumber);
    if (gender)       params.set('gender',        gender);
    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(`/api/groups/available${query}`);
    if (!response.ok) throw new Error('Failed to fetch groups');
    const data = await response.json();
    return data as PublicGroup[];
  } catch (error) {
    console.error('Error fetching public groups:', error);
    return [];
  }
}

/** Admin assigns a supervisor to a group */
export async function assignSupervisor(
  groupId: string,
  supervisorId: string
): Promise<void> {
  const session = await import('../lib/supabase').then((m) =>
    m.supabase.auth.getSession()
  );
  const token = session.data.session?.access_token;

  const response = await fetch(`/api/groups/${groupId}/assign-supervisor`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ supervisor_id: supervisorId }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to assign supervisor');
  }
}

/** Admin updates a group's status (approve/reject) */
export async function updateGroupStatus(
  groupId: string,
  status: 'approved' | 'rejected' | 'pending'
): Promise<void> {
  const session = await import('../lib/supabase').then((m) =>
    m.supabase.auth.getSession()
  );
  const token = session.data.session?.access_token;

  const response = await fetch(`/api/groups/${groupId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to update group status');
  }
}

async function getAdminToken() {
  const session = await import('../lib/supabase').then((m) => m.supabase.auth.getSession());
  return session.data.session?.access_token;
}

/** Admin deletes a group and all its members */
export async function deleteGroup(groupId: string): Promise<void> {
  const token = await getAdminToken();
  const response = await fetch(`/api/groups/${groupId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete group');
  }
}

/** Admin updates group project name, removes members, and/or adds members */
export async function updateGroup(
  groupId: string,
  changes: { projectName?: string; removeMemberIds?: string[]; addMemberIds?: string[]; removeSupervisor?: boolean }
): Promise<void> {
  const token = await getAdminToken();
  const response = await fetch(`/api/groups/${groupId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(changes),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to update group');
  }
}
