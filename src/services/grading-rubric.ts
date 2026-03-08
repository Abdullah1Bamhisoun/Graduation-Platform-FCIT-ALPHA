/**
 * Grading Rubric Service
 *
 * Handles all operations for the rubric-based grading system:
 * - Fetching/updating rubric criteria (coordinator editable)
 * - Fetching/updating grading components (weights, coordinator editable)
 * - Supervisor per-criterion scores with normalization
 * - Committee per-criterion scores with averaging
 * - Coordinator deliverable scores
 */

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradingComponent {
  id: string;
  courseType: '498' | '499';
  componentKey: string;
  componentName: string;
  totalMarks: number;
  evaluatorRole: string;
  displayOrder: number;
  isActive: boolean;
}

export interface RubricCriterion {
  id: string;
  courseType: '498' | '499';
  componentKey: string;
  criterionKey: string;
  criterionName: string;
  maxRawScore: number;
  description1?: string;
  description2?: string;
  description3?: string;
  description4?: string;
  description5?: string;
  displayOrder: number;
  isActive: boolean;
}

export interface SupervisorRubricScore {
  studentId: string;
  groupId: string;
  courseId: string;
  criterionKey: string;
  rawScore: number;  // 1-5
  gradedBy?: string;
  gradedAt?: string;
  submissionStatus: 'draft' | 'submitted' | 'locked';
}

export interface CommitteeRubricScore {
  groupId: string;
  courseId: string;
  evaluatorId: string;
  criterionKey: string;
  score: number;  // 0-5
  submissionStatus: 'draft' | 'submitted' | 'locked';
  submittedAt?: string;
}

export interface CoordinatorDeliverableScore {
  id: string;
  groupId: string;
  courseId: string;
  deliverableKey: string;
  score: number;
  maxScore: number;
  gradedBy?: string;
  gradedAt?: string;
  isLocked?: boolean;
}

export interface CoordinatorRubricScore {
  studentId: string;
  groupId: string;
  courseId: string;
  criterionKey: string;
  rawScore: number;  // 1-5
  gradedBy?: string;
  gradedAt?: string;
  submissionStatus: 'draft' | 'submitted';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapComponent(row: any): GradingComponent {
  return {
    id:            row.id,
    courseType:    row.course_type,
    componentKey:  row.component_key,
    componentName: row.component_name,
    totalMarks:    Number(row.total_marks),
    evaluatorRole: row.evaluator_role,
    displayOrder:  row.display_order,
    isActive:      row.is_active,
  };
}

function mapCriterion(row: any): RubricCriterion {
  return {
    id:            row.id,
    courseType:    row.course_type,
    componentKey:  row.component_key,
    criterionKey:  row.criterion_key,
    criterionName: row.criterion_name,
    maxRawScore:   Number(row.max_raw_score),
    description1:  row.description_1 ?? undefined,
    description2:  row.description_2 ?? undefined,
    description3:  row.description_3 ?? undefined,
    description4:  row.description_4 ?? undefined,
    description5:  row.description_5 ?? undefined,
    displayOrder:  row.display_order,
    isActive:      row.is_active,
  };
}

// ─── Grading Components ───────────────────────────────────────────────────────

/**
 * Fetch all high-level grading components for a course.
 */
export async function getGradingComponents(
  courseType: '498' | '499'
): Promise<GradingComponent[]> {
  const { data, error } = await supabase
    .from('grading_components')
    .select('*')
    .eq('course_type', courseType)
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('getGradingComponents error:', error);
    return [];
  }
  return (data || []).map(mapComponent);
}

/**
 * Update a grading component's name and total marks.
 * Coordinator only — validated on save that total = 100.
 */
export async function updateGradingComponent(
  id: string,
  patch: { componentName?: string; totalMarks?: number }
): Promise<void> {
  const update: any = { updated_at: new Date().toISOString() };
  if (patch.componentName !== undefined) update.component_name = patch.componentName;
  if (patch.totalMarks    !== undefined) update.total_marks    = patch.totalMarks;

  const { error } = await supabase
    .from('grading_components')
    .update(update)
    .eq('id', id);

  if (error) throw error;
}

// ─── Rubric Criteria ──────────────────────────────────────────────────────────

/**
 * Fetch all rubric criteria for a specific component.
 */
export async function getRubricCriteria(
  courseType: '498' | '499',
  componentKey: string
): Promise<RubricCriterion[]> {
  const { data, error } = await supabase
    .from('grading_rubric_criteria')
    .select('*')
    .eq('course_type', courseType)
    .eq('component_key', componentKey)
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('getRubricCriteria error:', error);
    return [];
  }
  return (data || []).map(mapCriterion);
}

/**
 * Fetch ALL rubric criteria for a course (all components combined).
 */
export async function getAllRubricCriteria(
  courseType: '498' | '499'
): Promise<RubricCriterion[]> {
  const { data, error } = await supabase
    .from('grading_rubric_criteria')
    .select('*')
    .eq('course_type', courseType)
    .eq('is_active', true)
    .order('component_key')
    .order('display_order');

  if (error) {
    console.error('getAllRubricCriteria error:', error);
    return [];
  }
  return (data || []).map(mapCriterion);
}

/**
 * Update a single rubric criterion (coordinator editable).
 */
export async function updateRubricCriterion(
  id: string,
  patch: {
    criterionName?: string;
    maxRawScore?: number;
    description1?: string;
    description2?: string;
    description3?: string;
    description4?: string;
    description5?: string;
  }
): Promise<void> {
  const update: any = { updated_at: new Date().toISOString() };
  if (patch.criterionName !== undefined) update.criterion_name = patch.criterionName;
  if (patch.maxRawScore   !== undefined) update.max_raw_score  = patch.maxRawScore;
  if (patch.description1  !== undefined) update.description_1  = patch.description1;
  if (patch.description2  !== undefined) update.description_2  = patch.description2;
  if (patch.description3  !== undefined) update.description_3  = patch.description3;
  if (patch.description4  !== undefined) update.description_4  = patch.description4;
  if (patch.description5  !== undefined) update.description_5  = patch.description5;

  const { error } = await supabase
    .from('grading_rubric_criteria')
    .update(update)
    .eq('id', id);

  if (error) throw error;
}

/**
 * Create a new rubric criterion.
 */
export async function createRubricCriterion(params: {
  courseType: '498' | '499';
  componentKey: string;
  criterionKey: string;
  criterionName: string;
  maxRawScore: number;
  description1?: string;
  description2?: string;
  description3?: string;
  description4?: string;
  description5?: string;
  displayOrder?: number;
}): Promise<RubricCriterion> {
  const {
    courseType,
    componentKey,
    criterionKey,
    criterionName,
    maxRawScore,
    description1,
    description2,
    description3,
    description4,
    description5,
    displayOrder = 0,
  } = params;

  const { data, error } = await supabase
    .from('grading_rubric_criteria')
    .insert({
      course_type:    courseType,
      component_key:  componentKey,
      criterion_key:  criterionKey,
      criterion_name: criterionName,
      max_raw_score:  maxRawScore,
      description_1:  description1 ?? null,
      description_2:  description2 ?? null,
      description_3:  description3 ?? null,
      description_4:  description4 ?? null,
      description_5:  description5 ?? null,
      display_order:  displayOrder,
      is_active:      true,
      updated_at:     new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Failed to create criterion');

  return mapCriterion(data);
}

/**
 * Soft-delete a rubric criterion by marking it inactive.
 */
export async function deleteRubricCriterion(id: string): Promise<void> {
  const { error } = await supabase
    .from('grading_rubric_criteria')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw error;
}

// ─── Supervisor Rubric Scores ─────────────────────────────────────────────────

/**
 * Fetch supervisor's rubric scores for a student.
 */
export async function getSupervisorRubricScores(
  studentId: string,
  groupId: string,
  courseId: string
): Promise<SupervisorRubricScore[]> {
  const { data, error } = await supabase
    .from('supervisor_rubric_scores')
    .select('*')
    .eq('student_id', studentId)
    .eq('group_id', groupId)
    .eq('course_id', courseId);

  if (error) {
    console.error('getSupervisorRubricScores error:', error);
    return [];
  }
  return (data || []).map(row => ({
    studentId:        row.student_id,
    groupId:          row.group_id,
    courseId:         row.course_id,
    criterionKey:     row.criterion_key,
    rawScore:         row.raw_score,
    gradedBy:         row.graded_by,
    gradedAt:         row.graded_at,
    submissionStatus: row.submission_status,
  }));
}

/**
 * Save supervisor rubric scores for a student (upsert all criteria at once).
 * Returns the normalized final score.
 */
export async function saveSupervisorRubricScores(params: {
  studentId: string;
  groupId: string;
  courseId: string;
  courseType: '498' | '499';
  scores: Record<string, number>;  // criterionKey → rawScore (1-5)
  gradedBy: string;
  submissionStatus?: 'draft' | 'submitted' | 'locked';
}): Promise<number> {
  const { studentId, groupId, courseId, courseType, scores, gradedBy, submissionStatus = 'draft' } = params;

  const rows = Object.entries(scores).map(([criterionKey, rawScore]) => ({
    student_id:        studentId,
    group_id:          groupId,
    course_id:         courseId,
    criterion_key:     criterionKey,
    raw_score:         rawScore,
    graded_by:         gradedBy,
    graded_at:         new Date().toISOString(),
    submission_status: submissionStatus,
  }));

  const { error } = await supabase
    .from('supervisor_rubric_scores')
    .upsert(rows, { onConflict: 'student_id,group_id,course_id,criterion_key' });

  if (error) throw error;

  // Also sync normalized score to supervisor_assessments (for backward compat)
  const normalizedScore = await calcSupervisorNormalizedScore(courseType, scores);
  await supabase
    .from('supervisor_assessments')
    .upsert({
      student_id: studentId,
      group_id:   groupId,
      course_id:  courseId,
      score:      normalizedScore,
      max_score:  courseType === '499' ? 23 : 18,
      graded_by:  gradedBy,
    }, { onConflict: 'student_id,group_id,course_id' });

  return normalizedScore;
}

/**
 * Calculate normalized supervisor score from raw criterion scores.
 * Formula: (rawTotal / maxRawTotal) × componentTotalMarks
 */
export async function calcSupervisorNormalizedScore(
  courseType: '498' | '499',
  scores: Record<string, number>
): Promise<number> {
  const criteria = await getRubricCriteria(courseType, 'supervisor_eval');
  const components = await getGradingComponents(courseType);

  const totalMarks = components.find(c => c.componentKey === 'supervisor_eval')?.totalMarks
    ?? (courseType === '499' ? 23 : 18);

  const maxRaw = criteria.reduce((sum, c) => sum + c.maxRawScore, 0);
  const rawTotal = criteria.reduce((sum, c) => sum + (scores[c.criterionKey] ?? 0), 0);

  if (maxRaw === 0) return 0;
  return Math.round((rawTotal / maxRaw) * totalMarks * 100) / 100;
}

// ─── Committee Rubric Scores ──────────────────────────────────────────────────

/**
 * Fetch committee rubric scores for a group by a specific evaluator.
 */
export async function getCommitteeRubricScores(
  groupId: string,
  courseId: string,
  evaluatorId: string
): Promise<CommitteeRubricScore[]> {
  const { data, error } = await supabase
    .from('committee_rubric_scores')
    .select('*')
    .eq('group_id', groupId)
    .eq('course_id', courseId)
    .eq('evaluator_id', evaluatorId);

  if (error) {
    console.error('getCommitteeRubricScores error:', error);
    return [];
  }
  return (data || []).map(row => ({
    groupId:          row.group_id,
    courseId:         row.course_id,
    evaluatorId:      row.evaluator_id,
    criterionKey:     row.criterion_key,
    score:            row.score,
    submissionStatus: row.submission_status,
    submittedAt:      row.submitted_at,
  }));
}

/**
 * Save committee rubric scores for a group (upsert all criteria at once).
 */
export async function saveCommitteeRubricScores(params: {
  groupId: string;
  courseId: string;
  evaluatorId: string;
  scores: Record<string, number>;  // criterionKey → score (0-5)
  submissionStatus?: 'draft' | 'submitted' | 'locked';
}): Promise<void> {
  const { groupId, courseId, evaluatorId, scores, submissionStatus = 'draft' } = params;

  const rows = Object.entries(scores).map(([criterionKey, score]) => ({
    group_id:          groupId,
    course_id:         courseId,
    evaluator_id:      evaluatorId,
    criterion_key:     criterionKey,
    score,
    submitted_at:      new Date().toISOString(),
    submission_status: submissionStatus,
  }));

  const { error } = await supabase
    .from('committee_rubric_scores')
    .upsert(rows, { onConflict: 'group_id,course_id,evaluator_id,criterion_key' });

  if (error) throw error;

  // If submitting, sync average to committee_evaluations (backward compat)
  if (submissionStatus === 'submitted' || submissionStatus === 'locked') {
    const total = Object.values(scores).reduce((s, v) => s + v, 0);
    await supabase
      .from('committee_evaluations')
      .upsert({
        group_id:     groupId,
        course_id:    courseId,
        evaluator_id: evaluatorId,
        score:        total,
        max_score:    40,
      }, { onConflict: 'group_id,course_id,evaluator_id' });
  }
}

/**
 * Get all committee rubric scores for a group across all evaluators.
 * Returns per-criterion averages and total average.
 */
export async function getCommitteeAverageScores(
  groupId: string,
  courseId: string
): Promise<{
  criterionAverages: Record<string, number>;
  totalAverage: number;
  evaluatorCount: number;
}> {
  const { data, error } = await supabase
    .from('committee_rubric_scores')
    .select('criterion_key, score, evaluator_id')
    .eq('group_id', groupId)
    .eq('course_id', courseId)
    .in('submission_status', ['submitted', 'locked']);

  if (error || !data || data.length === 0) {
    return { criterionAverages: {}, totalAverage: 0, evaluatorCount: 0 };
  }

  // Group by evaluator, then average per criterion
  const evaluators = new Set(data.map((r: any) => r.evaluator_id));
  const evaluatorCount = evaluators.size;

  const criterionSums: Record<string, number> = {};
  const criterionCounts: Record<string, number> = {};

  for (const row of data as any[]) {
    criterionSums[row.criterion_key] = (criterionSums[row.criterion_key] ?? 0) + row.score;
    criterionCounts[row.criterion_key] = (criterionCounts[row.criterion_key] ?? 0) + 1;
  }

  const criterionAverages: Record<string, number> = {};
  for (const key of Object.keys(criterionSums)) {
    criterionAverages[key] = criterionSums[key] / criterionCounts[key];
  }

  const totalAverage = Object.values(criterionAverages).reduce((s, v) => s + v, 0);

  return { criterionAverages, totalAverage, evaluatorCount };
}

// ─── Coordinator Deliverable Scores ──────────────────────────────────────────

/**
 * Fetch coordinator deliverable scores for a group.
 */
export async function getCoordinatorDeliverableScores(
  groupId: string,
  courseId: string
): Promise<CoordinatorDeliverableScore[]> {
  const { data, error } = await supabase
    .from('coordinator_deliverable_scores')
    .select('*')
    .eq('group_id', groupId)
    .eq('course_id', courseId);

  if (error) {
    console.error('getCoordinatorDeliverableScores error:', error);
    return [];
  }
  return (data || []).map(row => ({
    id:             row.id,
    groupId:        row.group_id,
    courseId:       row.course_id,
    deliverableKey: row.deliverable_key,
    score:          Number(row.score),
    maxScore:       Number(row.max_score),
    gradedBy:       row.graded_by,
    gradedAt:       row.graded_at,
    isLocked:       row.is_locked,
  }));
}

/**
 * Save a single coordinator deliverable score.
 */
export async function saveCoordinatorDeliverableScore(params: {
  groupId: string;
  courseId: string;
  deliverableKey: string;
  score: number;
  maxScore: number;
  gradedBy: string;
}): Promise<void> {
  const { groupId, courseId, deliverableKey, score, maxScore, gradedBy } = params;

  const { error } = await supabase
    .from('coordinator_deliverable_scores')
    .upsert({
      group_id:        groupId,
      course_id:       courseId,
      deliverable_key: deliverableKey,
      score,
      max_score:       maxScore,
      graded_by:       gradedBy,
      graded_at:       new Date().toISOString(),
    }, { onConflict: 'group_id,course_id,deliverable_key' });

  if (error) throw error;
}

/**
 * Save all coordinator deliverable scores for a group at once.
 */
export async function saveAllCoordinatorDeliverables(params: {
  groupId: string;
  courseId: string;
  courseType: '498' | '499';
  scores: Record<string, number>;  // deliverableKey → score
  gradedBy: string;
}): Promise<void> {
  const { groupId, courseId, courseType, scores, gradedBy } = params;

  // Get criteria to know maxScore per deliverable
  const criteria = await getRubricCriteria(courseType, 'coordinator_deliverables');
  const maxScoreMap: Record<string, number> = {};
  for (const c of criteria) maxScoreMap[c.criterionKey] = c.maxRawScore;

  const rows = Object.entries(scores).map(([key, score]) => ({
    group_id:        groupId,
    course_id:       courseId,
    deliverable_key: key,
    score:           Math.min(score, maxScoreMap[key] ?? 99),
    max_score:       maxScoreMap[key] ?? 0,
    graded_by:       gradedBy,
    graded_at:       new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('coordinator_deliverable_scores')
    .upsert(rows, { onConflict: 'group_id,course_id,deliverable_key' });

  if (error) throw error;
}

/**
 * Get total coordinator deliverable score for a group.
 */
export async function getCoordinatorDeliverableTotal(
  groupId: string,
  courseId: string
): Promise<number> {
  const scores = await getCoordinatorDeliverableScores(groupId, courseId);
  return scores.reduce((sum, s) => sum + s.score, 0);
}

// ─── Weekly Progress Normalization ───────────────────────────────────────────

/**
 * Calculate weekly progress score using the official formula:
 *   StudentScore = (StudentSubmissions / OpenWeeks) × 11
 *   SupervisorScore = (SupervisorResponses / OpenWeeks) × 11
 *   Total = StudentScore + SupervisorScore (max 22)
 */
export async function calcWeeklyNormalizedScore(
  groupId: string,
  courseType: '498' | '499',
  semester = 'DEFAULT'
): Promise<{
  openWeeks: number;
  studentSubmissions: number;
  supervisorResponses: number;
  studentScore: number;
  supervisorScore: number;
  totalScore: number;
  maxMarks: number;
}> {
  const maxMarks = 22; // Both courses = 22

  // Count open weeks
  const { data: weekData } = await supabase
    .from('week_statuses')
    .select('week_number, is_open, was_opened')
    .eq('course_type', courseType)
    .eq('semester', semester);

  const openWeeks = (weekData || []).filter((w: any) => w.was_opened || w.is_open).length;

  if (openWeeks === 0) {
    return { openWeeks: 0, studentSubmissions: 0, supervisorResponses: 0,
             studentScore: 0, supervisorScore: 0, totalScore: 0, maxMarks };
  }

  const openWeekNumbers = (weekData || [])
    .filter((w: any) => w.was_opened || w.is_open)
    .map((w: any) => w.week_number);

  // Count submissions and responses in open weeks
  const { data: reports } = await supabase
    .from('weekly_reports')
    .select('student_mark, supervisor_mark, week_number')
    .eq('group_id', groupId)
    .in('week_number', openWeekNumbers);

  let studentSubmissions = 0;
  let supervisorResponses = 0;
  for (const r of reports || []) {
    if ((r as any).student_mark === 1) studentSubmissions++;
    if ((r as any).supervisor_mark === 1) supervisorResponses++;
  }

  const studentScore    = (studentSubmissions / openWeeks) * 11;
  const supervisorScore = (supervisorResponses / openWeeks) * 11;
  const totalScore      = Math.min(studentScore + supervisorScore, maxMarks);

  return {
    openWeeks,
    studentSubmissions,
    supervisorResponses,
    studentScore:    Math.round(studentScore * 100) / 100,
    supervisorScore: Math.round(supervisorScore * 100) / 100,
    totalScore:      Math.round(totalScore * 100) / 100,
    maxMarks,
  };
}

// ─── Coordinator Evaluation Scores ──────────────────────────────────────────

/**
 * Find the active grading component for the coordinator evaluator role.
 * This is the "Senior Project Coordinator" component in the Grade Scheme Editor.
 * Falls back to component_key = 'coordinator_eval' if none is found.
 */
export async function getCoordinatorEvalComponent(
  courseType: '498' | '499'
): Promise<GradingComponent | null> {
  const { data, error } = await supabase
    .from('grading_components')
    .select('*')
    .eq('course_type', courseType)
    .eq('evaluator_role', 'coordinator')
    .eq('is_active', true)
    .order('display_order')
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return mapComponent(data);
}

/**
 * Fetch coordinator rubric criteria dynamically from the Grade Scheme Editor.
 * Looks up the active coordinator component (Senior Project Coordinator) and
 * fetches its criteria — so the evaluation form always reflects the latest scheme.
 */
export async function getCoordinatorRubricCriteria(
  courseType: '498' | '499'
): Promise<RubricCriterion[]> {
  const component = await getCoordinatorEvalComponent(courseType);
  const componentKey = component?.componentKey ?? 'coordinator_eval';
  return getRubricCriteria(courseType, componentKey);
}

/**
 * Fetch coordinator's rubric scores for a group.
 */
export async function getCoordinatorRubricScores(
  groupId: string,
  courseId: string
): Promise<CoordinatorRubricScore[]> {
  const { data, error } = await supabase
    .from('coordinator_evaluations')
    .select('*')
    .eq('group_id', groupId)
    .eq('course_id', courseId);

  if (error) {
    console.error('getCoordinatorRubricScores error:', error);
    return [];
  }
  return (data || []).map(row => ({
    studentId:        row.student_id,
    groupId:          row.group_id,
    courseId:         row.course_id,
    criterionKey:     row.criterion_key,
    rawScore:         row.raw_score,
    gradedBy:         row.graded_by,
    gradedAt:         row.graded_at,
    submissionStatus: row.submission_status,
  }));
}

/**
 * Save coordinator rubric scores for a group (upsert all criteria at once).
 * Returns the normalized final score.
 */
export async function saveCoordinatorRubricScores(params: {
  groupId: string;
  courseId: string;
  courseType: '498' | '499';
  scores: Record<string, number>;  // criterionKey → rawScore (1-5)
  gradedBy: string;
  submissionStatus?: 'draft' | 'submitted';
}): Promise<number> {
  const { groupId, courseId, courseType, scores, gradedBy, submissionStatus = 'draft' } = params;

  const rows = Object.entries(scores).map(([criterionKey, rawScore]) => ({
    group_id:          groupId,
    course_id:         courseId,
    criterion_key:     criterionKey,
    raw_score:         rawScore,
    graded_by:         gradedBy,
    graded_at:         new Date().toISOString(),
    submission_status: submissionStatus,
  }));

  const { error } = await supabase
    .from('coordinator_evaluations')
    .upsert(rows, { onConflict: 'group_id,course_id,criterion_key' });

  if (error) throw error;

  // Also sync normalized score to coordinator_assessments (for backward compat)
  const normalizedScore = await calcCoordinatorNormalizedScore(courseType, scores);
  await supabase
    .from('coordinator_assessments')
    .upsert({
      group_id:          groupId,
      course_id:         courseId,
      component_key:     'coordinator_eval',
      normalized_score:  normalizedScore,
      max_score:         await getComponentMaxScore(courseType, 'coordinator_eval'),
      submission_status: submissionStatus,
    }, { onConflict: 'group_id,course_id,component_key' });

  return normalizedScore;
}

/**
 * Calculate normalized coordinator score from raw criterion scores.
 * Formula: (rawTotal / maxRawTotal) × componentTotalMarks
 * Dynamically resolves the coordinator component from the Grade Scheme Editor.
 */
export async function calcCoordinatorNormalizedScore(
  courseType: '498' | '499',
  scores: Record<string, number>
): Promise<number> {
  const [criteria, component] = await Promise.all([
    getCoordinatorRubricCriteria(courseType),
    getCoordinatorEvalComponent(courseType),
  ]);

  const totalMarks = component?.totalMarks ?? 20;

  const maxRaw = criteria.reduce((sum, c) => sum + c.maxRawScore, 0);
  const rawTotal = criteria.reduce((sum, c) => sum + (scores[c.criterionKey] ?? 0), 0);

  if (maxRaw === 0) return 0;
  return Math.round((rawTotal / maxRaw) * totalMarks * 100) / 100;
}

/**
 * Helper to get component max score.
 */
async function getComponentMaxScore(
  courseType: '498' | '499',
  componentKey: string
): Promise<number> {
  const components = await getGradingComponents(courseType);
  return components.find(c => c.componentKey === componentKey)?.totalMarks ?? 20;
}
