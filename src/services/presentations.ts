import { supabase } from '../lib/supabase';
import type { PresentationSchedule, StudentPresentationSelection } from '../types';

const SCHEDULE_SELECT = `
  *,
  group:groups!group_id(
    id, group_code, project_name, project_description,
    members:group_members(student:profiles!student_id(id, name, student_id))
  )
`;

function mapDbPresentationSchedule(data: any): PresentationSchedule {
  const group = data.group;
  return {
    groupId: data.group_id,
    groupName: group?.group_code ?? '',
    students: (group?.members || []).map((m: any) => ({
      id: m.student?.id ?? '',
      name: m.student?.name ?? '',
    })),
    day: data.day,
    timeSlot: data.time_slot,
    projectName: group?.project_name ?? '',
    projectDescription: group?.project_description ?? '',
    committeeMembers: data.committee_members ?? [],
  };
}

function mapDbPresentationSelection(data: any): StudentPresentationSelection {
  const group = data.group;
  const schedule = data.schedule;
  return {
    groupId: group?.id ?? data.group_id,
    groupName: group?.group_code ?? '',
    students: (group?.members || []).map((m: any) => ({
      id: m.student?.id ?? '',
      name: m.student?.name ?? '',
    })),
    projectName: group?.project_name ?? '',
    projectDescription: group?.project_description ?? '',
    selectedDay: schedule?.day ?? undefined,
    selectedTimeSlot: schedule?.time_slot ?? undefined,
    selectedAt: schedule?.updated_at ?? undefined,
  };
}

export async function getPresentationSchedules(): Promise<PresentationSchedule[]> {
  try {
    const { data, error } = await supabase
      .from('presentation_schedules')
      .select(SCHEDULE_SELECT)
      .order('day');

    if (error) throw error;
    return (data || []).map(mapDbPresentationSchedule);
  } catch (error) {
    console.error('Error fetching presentation schedules:', error);
    return [];
  }
}

export async function getPresentationForGroup(groupId: string): Promise<PresentationSchedule | null> {
  try {
    const { data, error } = await supabase
      .from('presentation_schedules')
      .select(SCHEDULE_SELECT)
      .eq('group_id', groupId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDbPresentationSchedule(data) : null;
  } catch (error) {
    console.error('Error fetching group presentation:', error);
    return null;
  }
}

export async function getStudentPresentationSelections(): Promise<StudentPresentationSelection[]> {
  try {
    // Get all groups with their optional presentation schedule
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select(`
        id, group_code, project_name, project_description,
        members:group_members(student:profiles!student_id(id, name, student_id))
      `)
      .order('group_code');

    if (gError) throw gError;

    // Get all presentation schedules
    const { data: schedules, error: sError } = await supabase
      .from('presentation_schedules')
      .select('*');

    if (sError) throw sError;

    const scheduleMap = new Map<string, any>();
    (schedules || []).forEach((s: any) => scheduleMap.set(s.group_id, s));

    return (groups || []).map((g: any) => {
      const schedule = scheduleMap.get(g.id);
      return mapDbPresentationSelection({ group: g, group_id: g.id, schedule });
    });
  } catch (error) {
    console.error('Error fetching presentation selections:', error);
    return [];
  }
}

export async function updatePresentationSelection(
  groupId: string,
  day: string,
  timeSlot: string
): Promise<void> {
  // Upsert — if schedule exists, update; otherwise create
  const { error } = await supabase
    .from('presentation_schedules')
    .upsert({
      group_id: groupId,
      day,
      time_slot: timeSlot,
      committee_members: [],
    }, { onConflict: 'group_id' });

  if (error) throw error;
}

export async function createPresentationSchedule(schedule: {
  groupId: string;
  day: string;
  timeSlot: string;
  committeeMembers: string[];
}): Promise<void> {
  const { error } = await supabase
    .from('presentation_schedules')
    .upsert({
      group_id: schedule.groupId,
      day: schedule.day,
      time_slot: schedule.timeSlot,
      committee_members: schedule.committeeMembers,
    }, { onConflict: 'group_id' });

  if (error) throw error;
}
