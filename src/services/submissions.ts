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
  };
}

const SUBMISSION_SELECT = `
  *,
  milestone:milestones!milestone_id(name, course:courses!course_id(code)),
  student:profiles!student_id(name),
  group:groups!group_id(project_name),
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
