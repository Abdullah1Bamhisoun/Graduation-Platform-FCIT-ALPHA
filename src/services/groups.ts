import { supabase } from '../lib/supabase';
import { mapCourseCode } from './mappers';

export interface GroupData {
  id: string;
  groupCode: string;
  courseId: string;
  courseCode: string;
  projectName: string;
  projectDescription: string;
  supervisorId: string;
  supervisorName: string;
  members: { id: string; name: string; studentId?: string }[];
}

function mapDbGroup(data: any): GroupData {
  return {
    id: data.id,
    groupCode: data.group_code,
    courseId: data.course_id,
    courseCode: data.course ? mapCourseCode(data.course.code) : '',
    projectName: data.project_name,
    projectDescription: data.project_description ?? '',
    supervisorId: data.supervisor_id,
    supervisorName: data.supervisor?.name ?? '',
    members: (data.members || []).map((m: any) => ({
      id: m.student?.id ?? m.student_id,
      name: m.student?.name ?? '',
      studentId: m.student?.student_id ?? undefined,
    })),
  };
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
      .order('group_code');

    if (error) throw error;
    return (data || []).map(mapDbGroup);
  } catch (error) {
    console.error('Error fetching supervisor groups:', error);
    return [];
  }
}

export async function getGroupForStudent(studentId: string): Promise<GroupData | null> {
  try {
    const { data: membership, error: memError } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    if (memError) throw memError;
    if (!membership) return null;

    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .eq('id', membership.group_id)
      .single();

    if (error) throw error;
    return data ? mapDbGroup(data) : null;
  } catch (error) {
    console.error('Error fetching student group:', error);
    return null;
  }
}

export async function getAllGroups(): Promise<GroupData[]> {
  try {
    const { data, error } = await supabase
      .from('groups')
      .select(GROUP_SELECT)
      .order('group_code');

    if (error) throw error;
    return (data || []).map(mapDbGroup);
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
