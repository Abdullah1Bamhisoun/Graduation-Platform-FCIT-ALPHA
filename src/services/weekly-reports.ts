import { supabase } from '../lib/supabase';
import type { WeeklyReport } from '../types';
import { mapCourseCode, mapProgressStatus, mapSubmissionStatus, toDbProgressStatus } from './mappers';

function mapDbWeeklyReport(data: any): WeeklyReport {
  return {
    id:                      data.id,
    groupId:                 data.group_id,
    weekNumber:              data.week_number,
    dateRange:               data.date_range ?? '',
    course:                  data.course ? mapCourseCode(data.course.code) : 'CPIS-498',
    allMembersAttended:      data.all_members_attended ?? true,
    absentStudentName:       data.absent_student_name ?? undefined,
    progressStatus:          mapProgressStatus(data.progress_status ?? 'good'),
    supervisorComments:      data.supervisor_comments ?? '',
    submittedAt:             data.submitted_at ?? undefined,
    reviewedBy:              data.reviewer?.name ?? undefined,
    supervisorName:          data.group?.supervisor?.name ?? undefined,
    status:                  mapSubmissionStatus(data.status ?? 'submitted'),
    // ── Spec fields ──
    studentProgress:         data.student_progress ?? undefined,
    futureWork:              data.student_future_work ?? undefined,
    discussionPoints:        data.student_discussion_points ?? undefined,
    submissionStatus:        (data.submission_status ?? 'not_submitted') as 'not_submitted' | 'submitted',
    supervisorResponseStatus: (data.supervisor_response_status ?? 'pending') as 'pending' | 'responded',
    studentMark:             (data.student_mark ?? 0) as 0 | 1,
    supervisorMark:          (data.supervisor_mark ?? 0) as 0 | 1,
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

/**
 * Student submits their weekly progress.
 *
 * Rules (spec §4 & §6):
 *  - Week must be open (is_open = true) OR the group has an approved late_request.
 *  - On insert: student_mark auto-sets to 1 via DB trigger.
 *  - Uses UPSERT so re-submitting updates the content.
 */
export async function submitStudentWeeklyReport(report: {
  groupId: string;
  weekNumber: number;
  courseId: string;
  progress: string;
  futureWork: string;
  discussionPoints: string;
}): Promise<void> {
  const { error } = await supabase.from('weekly_reports').upsert(
    {
      group_id:                   report.groupId,
      week_number:                report.weekNumber,
      course_id:                  report.courseId,
      date_range:                 '',
      all_members_attended:       true,
      progress_status:            'good',
      supervisor_comments:        '',
      status:                     'submitted',
      student_progress:           report.progress,
      student_future_work:        report.futureWork,
      student_discussion_points:  report.discussionPoints,
      submission_status:          'submitted',  // triggers student_mark = 1 via DB trigger
    },
    { onConflict: 'group_id,week_number' }
  );

  if (error) throw error;
}

/**
 * Supervisor responds to a submitted weekly report.
 *
 * Rules (spec §6):
 *  - Supervisor cannot respond unless submission exists.
 *  - On respond: supervisor_mark auto-sets to 1 via DB trigger.
 */
export async function supervisorRespondToWeeklyReport(params: {
  groupId: string;
  weekNumber: number;
  progressStatus: string;
  supervisorComments: string;
  allMembersAttended: boolean;
  absentStudentName?: string;
  reviewedBy: string;
}): Promise<void> {
  // Ensure a student submission exists first
  const { data: existing } = await supabase
    .from('weekly_reports')
    .select('id, submission_status')
    .eq('group_id', params.groupId)
    .eq('week_number', params.weekNumber)
    .maybeSingle();

  if (!existing || existing.submission_status !== 'submitted') {
    throw new Error('Supervisor cannot respond until the student has submitted a report.');
  }

  const { error } = await supabase
    .from('weekly_reports')
    .update({
      progress_status:            toDbProgressStatus(params.progressStatus),
      supervisor_comments:        params.supervisorComments,
      all_members_attended:       params.allMembersAttended,
      absent_student_name:        params.absentStudentName ?? null,
      reviewed_by:                params.reviewedBy,
      status:                     'approved',
      supervisor_response_status: 'responded',  // triggers supervisor_mark = 1 via DB trigger
    })
    .eq('group_id', params.groupId)
    .eq('week_number', params.weekNumber);

  if (error) throw error;
}

/**
 * Legacy function kept for backwards compatibility.
 * @deprecated Use supervisorRespondToWeeklyReport instead.
 */
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
    group_id:             report.groupId,
    week_number:          report.weekNumber,
    date_range:           report.dateRange,
    course_id:            report.courseId,
    all_members_attended: report.allMembersAttended,
    absent_student_name:  report.absentStudentName ?? null,
    progress_status:      toDbProgressStatus(report.progressStatus),
    supervisor_comments:  report.supervisorComments,
    status:               'approved',
    reviewed_by:          report.reviewedBy ?? null,
  });

  if (error) throw error;
}
