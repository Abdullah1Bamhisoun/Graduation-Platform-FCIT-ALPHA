import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import type { Submission, SubmissionVersion, Feedback, RubricCriterion } from '../types';
import { mapSubmissionStatus } from './mappers';

// ── Module-level TTL cache ──────────────────────────────────────────────────
const SUBMISSIONS_CACHE_TTL = 60 * 1000; // 1 minute
interface CacheEntry<T> { data: T; fetchedAt: number }
const _byStudentCache = new Map<string, CacheEntry<Submission[]>>();
const _bySupervisorCache = new Map<string, CacheEntry<Submission[]>>();
const _byIdCache = new Map<string, CacheEntry<Submission | null>>();
const _byMilestoneStudentCache = new Map<string, CacheEntry<Submission | null>>();

function _isFresh<T>(e?: CacheEntry<T>): e is CacheEntry<T> {
  return !!e && Date.now() - e.fetchedAt < SUBMISSIONS_CACHE_TTL;
}

export function clearSubmissionsCache() {
  _byStudentCache.clear();
  _bySupervisorCache.clear();
  _byIdCache.clear();
  _byMilestoneStudentCache.clear();
}

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

export async function getSubmissionsForStudent(studentId: string, limit = 200): Promise<Submission[]> {
  const ck = `${studentId}:${limit}`;
  const cached = _byStudentCache.get(ck);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const result = (data || []).map(mapDbSubmission);
    _byStudentCache.set(ck, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching student submissions:', error);
    return [];
  }
}

export async function getSubmissionsForSupervisor(supervisorId: string, limit = 500): Promise<Submission[]> {
  const ck = `${supervisorId}:${limit}`;
  const cached = _bySupervisorCache.get(ck);
  if (_isFresh(cached)) return cached.data;

  try {
    // Get groups supervised by this user
    const { data: groups, error: gError } = await supabase
      .from('groups')
      .select('id')
      .eq('supervisor_id', supervisorId);

    if (gError) throw gError;
    if (!groups || groups.length === 0) {
      _bySupervisorCache.set(ck, { data: [], fetchedAt: Date.now() });
      return [];
    }

    const groupIds = groups.map((g: any) => g.id);

    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    const result = (data || []).map(mapDbSubmission);
    _bySupervisorCache.set(ck, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching supervisor submissions:', error);
    return [];
  }
}

export async function getSubmissionById(id: string): Promise<Submission | null> {
  const cached = _byIdCache.get(id);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('id', id)
      .single();

    if (error) throw error;
    const result = data ? mapDbSubmission(data) : null;
    _byIdCache.set(id, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching submission:', error);
    return null;
  }
}

export async function getSubmissionByMilestoneAndStudent(
  milestoneId: string,
  studentId: string
): Promise<Submission | null> {
  const ck = `${milestoneId}:${studentId}`;
  const cached = _byMilestoneStudentCache.get(ck);
  if (_isFresh(cached)) return cached.data;

  try {
    const { data, error } = await supabase
      .from('submissions')
      .select(SUBMISSION_SELECT)
      .eq('milestone_id', milestoneId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (error) throw error;
    const result = data ? mapDbSubmission(data) : null;
    _byMilestoneStudentCache.set(ck, { data: result, fetchedAt: Date.now() });
    return result;
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
    const res = await apiFetch(apiUrl(`/api/submissions/group-submission?${params.toString()}`), {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    });

    if (!res.ok) {
      if (res.status === 404) return null;
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch group submission');
    }

    const data = await res.json();
    return data ?? null;
  } catch (error) {
    console.error('Error fetching group submission:', error);
    return null;
  }
}

export async function createSubmission(submission: {
  milestoneId: string;
  studentId: string;
  groupId: string;
  fileName: string;
  fileSize: number;
  filePath: string;
  notes?: string;
}): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const res = await apiFetch(apiUrl('/api/submissions'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify({
      milestoneId: submission.milestoneId,
      studentId: submission.studentId,
      groupId: submission.groupId,
      fileName: submission.fileName,
      fileSize: submission.fileSize,
      filePath: submission.filePath,
      notes: submission.notes,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to create submission');
  }
  clearSubmissionsCache();
}

export async function createSubmissionVersion(
  submissionId: string,
  version: { version: number; fileName: string; fileSize: number; filePath: string; notes?: string }
): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const res = await apiFetch(apiUrl(`/api/submissions/${submissionId}/versions`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
    },
    body: JSON.stringify({
      version: version.version,
      fileName: version.fileName,
      fileSize: version.fileSize,
      filePath: version.filePath,
      notes: version.notes,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to create submission version');
  }
  clearSubmissionsCache();
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
  clearSubmissionsCache();
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
  filterGroup?: string,
  activeRole: string = 'coordinator'
): Promise<CoordinatorChapterSubmissionsResult> {
  try {
    const session = await import('../lib/supabase').then((m) => m.supabase.auth.getSession());
    const token = session.data.session?.access_token;

    const params = new URLSearchParams();
    params.set('courseType', courseType);
    if (filterGroup && filterGroup !== 'all') {
      params.set('filterGroup', filterGroup);
    }

    const response = await apiFetch(apiUrl(`/api/submissions/coordinator/chapter-submissions?${params.toString()}`), {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'X-Active-Role': activeRole,
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
          fileSize: v.file_size ?? v.fileSize ?? 0,
          uploadedAt: v.uploaded_at ?? v.uploadedAt ?? '',
          notes: v.notes ?? undefined,
          filePath: v.file_path ?? v.filePath ?? undefined,
        })),
        hasFeedback: s.hasFeedback,
        latestFeedback: s.latestFeedback,
      })),
      stats: data.stats || { total: 0, pending: 0, approved: 0, rejected: 0 },
    };
  } catch (error) {
    console.error('Error fetching coordinator chapter submissions:', error);
    return {
      submissions: [],
      stats: { total: 0, pending: 0, approved: 0, rejected: 0 },
    };
  }
}
