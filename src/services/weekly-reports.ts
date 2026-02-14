import { supabase } from '../lib/supabase';
import type { WeeklyReport } from '../types';
import { mapCourseCode, mapProgressStatus, mapSubmissionStatus, toDbProgressStatus } from './mappers';

function mapDbWeeklyReport(data: any): WeeklyReport {
  return {
    id: data.id,
    groupId: data.group_id,
    weekNumber: data.week_number,
    dateRange: data.date_range,
    course: data.course ? mapCourseCode(data.course.code) : 'CPIS-498',
    allMembersAttended: data.all_members_attended,
    absentStudentName: data.absent_student_name ?? undefined,
    progressStatus: mapProgressStatus(data.progress_status),
    supervisorComments: data.supervisor_comments,
    submittedAt: data.submitted_at ?? undefined,
    reviewedBy: data.reviewer?.name ?? undefined,
    supervisorName: data.group?.supervisor?.name ?? undefined,
    status: mapSubmissionStatus(data.status),
  };
}

const REPORT_SELECT = `
  *,
  course:courses!course_id(code),
  reviewer:profiles!reviewed_by(name),
  group:groups!group_id(supervisor:profiles!supervisor_id(name))
`;

export async function getWeeklyReportsByGroup(groupId: string): Promise<WeeklyReport[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_reports')
      .select(REPORT_SELECT)
      .eq('group_id', groupId)
      .order('week_number');

    if (error) throw error;
    return (data || []).map(mapDbWeeklyReport);
  } catch (error) {
    console.error('Error fetching weekly reports:', error);
    return [];
  }
}

export async function getWeeklyReportsForSupervisor(supervisorId: string): Promise<WeeklyReport[]> {
  try {
    // Get all groups this supervisor manages
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select('id')
      .eq('supervisor_id', supervisorId);

    if (gError) throw gError;
    if (!groups || groups.length === 0) return [];

    const groupIds = groups.map((g: any) => g.id);

    const { data, error } = await supabase
      .from('weekly_reports')
      .select(REPORT_SELECT)
      .in('group_id', groupIds)
      .order('week_number', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbWeeklyReport);
  } catch (error) {
    console.error('Error fetching supervisor weekly reports:', error);
    return [];
  }
}

export async function getAllWeeklyReports(): Promise<WeeklyReport[]> {
  try {
    const { data, error } = await supabase
      .from('weekly_reports')
      .select(REPORT_SELECT)
      .order('submitted_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbWeeklyReport);
  } catch (error) {
    console.error('Error fetching all weekly reports:', error);
    return [];
  }
}

export async function createWeeklyReport(report: {
  groupId: string;
  weekNumber: number;
  dateRange: string;
  courseId: string;
  allMembersAttended: boolean;
  absentStudentName?: string;
  progressStatus: string;
  supervisorComments: string;
  reviewedBy?: string;
}): Promise<void> {
  const { error } = await supabase.from('weekly_reports').insert({
    group_id: report.groupId,
    week_number: report.weekNumber,
    date_range: report.dateRange,
    course_id: report.courseId,
    all_members_attended: report.allMembersAttended,
    absent_student_name: report.absentStudentName ?? null,
    progress_status: toDbProgressStatus(report.progressStatus),
    supervisor_comments: report.supervisorComments,
    status: 'approved',
    reviewed_by: report.reviewedBy ?? null,
  });

  if (error) throw error;
}
