import { supabase } from '../lib/supabase';
import type { Submission, SubmissionVersion, Feedback, RubricCriterion } from '../types';
import { mapSubmissionStatus } from './mappers';

function mapDbVersion(data: any): SubmissionVersion {
  return {
    version: data.version,
    fileName: data.file_name,
    fileSize: data.file_size,
    uploadedAt: data.uploaded_at,
    notes: data.notes ?? undefined,
    filePath: data.file_path ?? undefined,
  };
}

function mapDbFeedback(data: any): Feedback {
  const rubric: RubricCriterion[] = (data.scores || []).map((s: any) => ({
    id: s.criterion?.id ?? s.rubric_criterion_id,
    name: s.criterion?.name ?? '',
    maxScore: s.criterion?.max_score ?? 0,
    score: Number(s.score),
    comment: s.comment ?? undefined,
  }));

  return {
    rubric,
    overallComment: data.overall_comment ?? '',
    reviewedBy: data.reviewer?.name ?? '',
    reviewedAt: data.reviewed_at,
    totalScore: Number(data.total_score ?? 0),
    maxScore: Number(data.max_score ?? 0),
  };
}

function mapDbSubmission(data: any): Submission {
  const milestone = data.milestone;
  const student = data.student;
  const group = data.group;
  const feedbackData = Array.isArray(data.feedback) ? data.feedback[0] : data.feedback;

  const groupMembers: { id: string; name: string }[] = (group?.members ?? []).map((m: any) => ({
    id: m.student?.id ?? m.student_id,
    name: m.student?.name ?? '',
  })).filter((m: any) => m.id);

  return {
    id: data.id,
    milestoneId: data.milestone_id,
    milestoneName: milestone?.name ?? '',
    studentId: data.student_id,
    studentName: student?.name ?? '',
    projectName: group?.project_name ?? '',
    submittedAt: data.updated_at ?? data.created_at,
    status: mapSubmissionStatus(data.status),
    currentVersion: data.current_version,
    versions: (data.versions || [])
      .sort((a: any, b: any) => a.version - b.version)
      .map(mapDbVersion),
    feedback: feedbackData ? mapDbFeedback(feedbackData) : undefined,
    groupId: data.group_id ?? undefined,
    groupMembers,
  };
}

const SUBMISSION_SELECT = `
  *,
  milestone:milestones!milestone_id(name, course:courses!course_id(code)),
  student:profiles!student_id(name),
  group:groups!group_id(project_name, members:group_members(student_id, student:profiles!student_id(id, name))),
  versions:submission_versions(*),
  feedback:submission_feedback(
    *,
    reviewer:profiles!reviewed_by(name),
    scores:feedback_scores(*, criterion:rubric_criteria!rubric_criterion_id(id, name, max_score))
  )
`;

export async function getSubmissionsForStudent(studentId: string): Promise<Submission[]> {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbSubmission);
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    return [];
  }
}

export async function getSubmissionsForSupervisor(supervisorId: string): Promise<Submission[]> {
  try {
    // Get groups supervised by this user
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select('id')
      .eq('supervisor_id', supervisorId);

    if (gError) throw gError;
    if (!groups || groups.length === 0) return [];

    const groupIds = groups.map((g: any) => g.id);

    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(mapDbSubmission);
  } catch (error) {
    console.error('Error fetching supervisor submissions:', error);
    return [];
  }
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? mapDbSubmission(data) : null;
  } catch (error) {
    console.error('Error fetching submission:', error);
    return null;
  }
}

export async function getSubmissionByMilestoneAndStudent(
  milestoneId: string,
  studentId: string
): Promise<Submission | null> {
  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('milestone_id', milestoneId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) throw error;
    return data ? mapDbSubmission(data) : null;
  } catch (error) {
    console.error('Error fetching submission:', error);
    return null;
  }
}

/**
 * Fetch the submission for a given milestone and group (group-shared lookup).
 * Routes through the backend API (supabaseAdmin) to bypass Supabase RLS,
 * so all group members can read the submission regardless of who uploaded it.
 */
export async function getSubmissionByMilestoneAndGroup(
  milestoneId: string,
  groupId: string
): Promise<Submission | null> {
  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    const params = new URLSearchParams({ milestoneId, groupId });
    const res = await fetch(`/api/submissions/group-submission?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch group submission');
    }

    const data = await res.json();
    return data ?? null;
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for group submission');
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(SUBMISSION_SELECT)
        .eq('milestone_id', milestoneId)
        .eq('group_id', groupId)
        .maybeSingle();
      if (error) throw error;
      return data ? mapDbSubmission(data) : null;
    } catch (sbError) {
      console.error('Supabase fallback failed for group submission:', sbError);
      return null;
    }
  }
}

export async function createSubmission(submission: {
  milestoneId: string;
  studentId: string;
  groupId: string;
  fileName: string;
  fileSize: string;
  filePath: string;
  notes?: string;
}): Promise<void> {
  // Create submission record
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      milestone_id: submission.milestoneId,
      student_id: submission.studentId,
      group_id: submission.groupId,
      status: 'submitted',
      current_version: 1,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Create first version
  const { error: vError } = await supabase.from('submission_versions').insert({
    submission_id: data.id,
    version: 1,
    file_name: submission.fileName,
    file_size: submission.fileSize,
    file_path: submission.filePath,
    notes: submission.notes ?? null,
  });

  if (vError) throw vError;
}

export async function createSubmissionVersion(
  submissionId: string,
  version: { version: number; fileName: string; fileSize: string; filePath: string; notes?: string }
): Promise<void> {
  // Insert new version
  const { error: vError } = await supabase.from('submission_versions').insert({
    submission_id: submissionId,
    version: version.version,
    file_name: version.fileName,
    file_size: version.fileSize,
    file_path: version.filePath,
    notes: version.notes ?? null,
  });

  if (vError) throw vError;

  // Update submission's current version and status
  const { error: sError } = await supabase
    .from('submissions')
    .update({ current_version: version.version, status: 'submitted' })
    .eq('id', submissionId);

  if (sError) throw sError;
}

export async function submitFeedback(feedback: {
  submissionId: string;
  overallComment: string;
  reviewedBy: string;
  totalScore: number;
  maxScore: number;
  scores: { rubricCriterionId: string; score: number; comment?: string }[];
  newStatus: string;
}): Promise<void> {
  // Create feedback record
  const { data, error: fError } = await supabase
    .from('submission_feedback')
    .insert({
      submission_id: feedback.submissionId,
      overall_comment: feedback.overallComment,
      reviewed_by: feedback.reviewedBy,
      total_score: feedback.totalScore,
      max_score: feedback.maxScore,
    })
    .select('id')
    .single();

  if (fError) throw fError;

  // Create individual scores
  if (feedback.scores.length > 0) {
    const scoreRows = feedback.scores.map((s) => ({
      feedback_id: data.id,
      rubric_criterion_id: s.rubricCriterionId,
      score: s.score,
      comment: s.comment ?? null,
    }));

    const { error: sError } = await supabase.from('feedback_scores').insert(scoreRows);
    if (sError) throw sError;
  }

  // Update submission status
  const { error: uError } = await supabase
    .from('submissions')
    .update({ status: feedback.newStatus })
    .eq('id', feedback.submissionId);

  if (uError) throw uError;
}

// ─── Coordinator-Specific Functions ────────────────────────────────────

export interface ChapterSubmission {
  id: string;
  groupId: string;
  groupNumber: number | null;
  projectName: string;
  studentId: string;
  studentName: string;
  milestoneId: string;
  milestoneName: string;
  milestoneType: string;
  dueDate: string | null;
  status: string;
  currentVersion: number;
  submittedAt: string;
  versions: SubmissionVersion[];
  hasFeedback: boolean;
  latestFeedback: Feedback | null;
}

export interface CoordinatorChapterSubmissionsResult {
  submissions: ChapterSubmission[];
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

/**
 * Fetch chapter submissions for coordinator's assigned course.
 * Coordinator-only endpoint: /api/submissions/coordinator/chapter-submissions
 */
export async function getChapterSubmissionsForCoordinator(
  courseType: '498' | '499',
  filterGroup?: string
): Promise<CoordinatorChapterSubmissionsResult> {
  try {
    const session = await import('../lib/supabase').then((m) => m.supabase.auth.getSession());
    const token = session.data.session?.access_token;

    const params = new URLSearchParams();
    params.set('courseType', courseType);
    if (filterGroup && filterGroup !== 'all') {
      params.set('filterGroup', filterGroup);
    }

    const response = await fetch(`/api/submissions/coordinator/chapter-submissions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'X-Active-Role': 'coordinator',
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to fetch chapter submissions');
    }

    const data = await response.json();
    return {
      submissions: (data.submissions || []).map((s: any) => ({
        id: s.id,
        groupId: s.groupId,
        groupNumber: s.groupNumber,
        projectName: s.projectName,
        studentId: s.studentId,
        studentName: s.studentName,
        milestoneId: s.milestoneId,
        milestoneName: s.milestoneName,
        milestoneType: s.milestoneType,
        dueDate: s.dueDate,
        status: s.status,
        currentVersion: s.currentVersion,
        submittedAt: s.submittedAt,
        versions: (s.versions || []).map((v: any) => ({
          version: v.version,
          fileName: v.file_name ?? v.fileName ?? '',
          fileSize: v.file_size ?? v.fileSize ?? '',
          uploadedAt: v.uploaded_at ?? v.uploadedAt ?? '',
          notes: v.notes ?? undefined,
          filePath: v.file_path ?? v.filePath ?? undefined,
        })),
        hasFeedback: s.hasFeedback,
        latestFeedback: s.latestFeedback,
      })),
      stats: data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 },
    };
  } catch {
    console.warn('Backend unavailable, falling back to Supabase for chapter submissions');
    try {
      // Find coordinator's course via user_roles
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { submissions: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } };

      const { data: userRoleData } = await supabase
        .from('user_roles')
        .select('coordinator_course_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const coordinatorCourseId = userRoleData?.coordinator_course_id;
      if (!coordinatorCourseId) return { submissions: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } };

      const { data: milestones } = await supabase
        .from('milestones')
        .select('id, name, type, due_date')
        .eq('course_id', coordinatorCourseId);

      const milestoneIds = (milestones || []).map((m: any) => m.id);
      if (milestoneIds.length === 0) return { submissions: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } };

      const milestoneMap = new Map((milestones || []).map((m: any) => [m.id, m]));

      let subQuery = supabase
        .from('submissions')
        .select(`*, student:profiles!student_id(name), group:groups!group_id(group_number, project_name), versions:submission_versions(*)`)
        .in('milestone_id', milestoneIds)
        .order('updated_at', { ascending: false });
      if (filterGroup && filterGroup !== 'all') subQuery = subQuery.eq('group_id', filterGroup);

      const { data: subs, error: subError } = await subQuery;
      if (subError) throw subError;

      const submissions: ChapterSubmission[] = (subs || []).map((s: any) => {
        const ms = milestoneMap.get(s.milestone_id) as any;
        return {
          id: s.id,
          groupId: s.group_id,
          groupNumber: s.group?.group_number ?? null,
          projectName: s.group?.project_name ?? '',
          studentId: s.student_id,
          studentName: s.student?.name ?? '',
          milestoneId: s.milestone_id,
          milestoneName: ms?.name ?? '',
          milestoneType: ms?.type ?? '',
          dueDate: ms?.due_date ?? null,
          status: s.status,
          currentVersion: s.current_version,
          submittedAt: s.updated_at ?? s.created_at,
          versions: (s.versions || []).map((v: any) => ({
            version: v.version,
            fileName: v.file_name ?? '',
            fileSize: v.file_size ?? '',
            uploadedAt: v.uploaded_at ?? '',
            notes: v.notes ?? undefined,
            filePath: v.file_path ?? undefined,
          })),
          hasFeedback: false,
          latestFeedback: null,
        };
      });

      const pending = submissions.filter(s => s.status === 'submitted').length;
      const approved = submissions.filter(s => s.status === 'approved').length;
      const rejected = submissions.filter(s => s.status === 'rejected').length;
      return { submissions, stats: { total: submissions.length, pending, approved, rejected } };
    } catch (sbError) {
      console.error('Supabase fallback failed for chapter submissions:', sbError);
      return { submissions: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } };
    }
  }
}
