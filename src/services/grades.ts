import { supabase } from '../lib/supabase';
import type { GroupGrade, StudentGrade, WeeklyGradeSummary } from '../types';
import { mapCourseCode, mapDeliverableStatus, toDbCourseCode } from './mappers';
import { getGradingSchemas, findSchemaWeight } from './grading-schemas';
import { getWeekStatuses, countOpenedWeeks } from './week-statuses';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DELIVERABLE_KEYS = [
  'chapter1', 'chapter2', 'chapter3', 'chapter4',
  'finalReport', 'revisedFinalReport', 'presentation',
] as const;

/** Default max scores per deliverable key; coordinator can override via DB. */
const DELIVERABLE_MAX_SCORES: Record<string, number> = {
  chapter1: 5, chapter2: 1, chapter3: 1, chapter4: 3,
  finalReport: 3, revisedFinalReport: 2, presentation: 0,
};

async function getCourseIdByCode(courseCode: string): Promise<string | null> {
  const dbCode = toDbCourseCode(courseCode);
  const { data } = await supabase
    .from('courses')
    .select('id')
    .eq('code', dbCode)
    .limit(1);
  return data?.[0]?.id ?? null;
}

/** Derive course_type ('498' | '499') from a course code string. */
function courseTypeFromCode(courseCode: string): '498' | '499' {
  return courseCode.includes('499') ? '499' : '498';
}

// ─── Weekly Cap Calculation ───────────────────────────────────────────────────

/**
 * Calculates the weekly grade component using direct accumulation with a hard cap.
 *
 * Spec rule (final):
 *   Each week = 2 marks (1 student submission + 1 supervisor response).
 *   Marks accumulate directly — NO normalization.
 *   Cap: CPIS-499 → 22 marks max, CPIS-498 → 20 marks max.
 *   Once the cap is reached, additional weeks add no further marks.
 *
 *   cappedScore = Math.min(totalRaw, maxWeeklyMarks)
 *   where maxWeeklyMarks = schema weight (22 for 499, 20 for 498)
 */
async function calcWeeklyGrade(
  groupId: string,
  courseCode: string,
  semester = 'DEFAULT'
): Promise<WeeklyGradeSummary> {
  const courseType = courseTypeFromCode(courseCode);

  const [weekStatuses, schemas] = await Promise.all([
    getWeekStatuses(courseType, semester),
    getGradingSchemas(courseType, semester),
  ]);

  const weeksOpened = countOpenedWeeks(weekStatuses);
  const maxRaw = weeksOpened * 2;

  // Schema weight IS the maximum weekly marks (22 for 499, 20 for 498)
  const weeklyWeight = findSchemaWeight(
    schemas,
    courseType === '499' ? 'Weekly Reports' : 'Weekly Progress'
  );
  const maxWeeklyMarks = weeklyWeight; // e.g. 22 or 20

  if (maxRaw === 0) {
    return {
      weeksOpened: 0, totalRaw: 0, maxRaw: 0,
      cappedScore: 0, maxWeeklyMarks,
      normalizedScore: 0, weight: weeklyWeight,
    };
  }

  // Sum student_mark + supervisor_mark only for weeks that were opened
  const openedWeekNumbers = weekStatuses
    .filter(ws => ws.wasOpened)
    .map(ws => ws.weekNumber);

  const { data: reports } = await supabase
    .from('weekly_reports')
    .select('student_mark, supervisor_mark, week_number')
    .eq('group_id', groupId)
    .in('week_number', openedWeekNumbers);

  let totalRaw = 0;
  const weekMarks: Record<number, { studentMark: number; supervisorMark: number }> = {};
  for (const r of reports || []) {
    const sm = r.student_mark ?? 0;
    const sv = r.supervisor_mark ?? 0;
    totalRaw += sm + sv;
    weekMarks[r.week_number] = { studentMark: sm, supervisorMark: sv };
  }

  // Cap at maxWeeklyMarks — no marks beyond the course maximum
  const cappedScore = Math.min(totalRaw, maxWeeklyMarks);

  return {
    weeksOpened,
    totalRaw,
    maxRaw,
    cappedScore,
    maxWeeklyMarks,
    normalizedScore: cappedScore, // kept for backward-compat; equals cappedScore
    weight: weeklyWeight,
    weekMarks,
  };
}

// ─── getGroupGrade ────────────────────────────────────────────────────────────

export async function getGroupGrade(
  groupId: string,
  courseCode: string,
  semester = 'DEFAULT'
): Promise<GroupGrade | null> {
  try {
    const courseId = await getCourseIdByCode(courseCode);
    if (!courseId) return null;

    const courseType = courseTypeFromCode(courseCode);

    // Group info
    const { data: group, error: gError } = await supabase
      .from('groups')
      .select(`
        id, group_code, project_name,
        supervisor:profiles!supervisor_id(name),
        members:group_members(student:profiles!student_id(id, name, student_id))
      `)
      .eq('id', groupId)
      .single();

    if (gError || !group) return null;

    // Deliverable grades (CPIS-498 only)
    let deliverables: any = {};
    let deliverablesTotal = 0;

    if (courseType === '498') {
      const { data: deliverableGrades } = await supabase
        .from('group_deliverable_grades')
        .select('*')
        .eq('group_id', groupId)
        .eq('course_id', courseId);

      const deliverableMap = new Map<string, any>();
      (deliverableGrades || []).forEach((d: any) => deliverableMap.set(d.deliverable_key, d));

      for (const key of DELIVERABLE_KEYS) {
        const grade = deliverableMap.get(key);
        const maxScore = DELIVERABLE_MAX_SCORES[key] ?? 0;
        if (grade) {
          const score = grade.score != null ? Number(grade.score) : undefined;
          deliverables[key] = { score, maxScore, status: mapDeliverableStatus(grade.status) };
          if (score != null) deliverablesTotal += score;
        } else {
          deliverables[key] = { maxScore, status: 'not-submitted' as const };
        }
      }
    }

    // Weekly normalized score
    const weeklySummary = await calcWeeklyGrade(groupId, courseCode, semester);

    // Supervisor assessments
    const { data: assessments } = await supabase
      .from('supervisor_assessments')
      .select('*, grader:profiles!graded_by(name)')
      .eq('group_id', groupId)
      .eq('course_id', courseId);

    const supervisorAssessment: GroupGrade['supervisorAssessment'] = {};
    const students = (group as any).members || [];
    for (const m of students) {
      const studentId = m.student?.id ?? m.student_id;
      const assessment = (assessments || []).find((a: any) => a.student_id === studentId);
      supervisorAssessment[studentId] = {
        score:     assessment ? Number(assessment.score) : undefined,
        maxScore:  courseType === '499' ? 23 : 20,
        comment:   assessment?.comment ?? undefined,
        gradedBy:  assessment?.grader?.name ?? (group as any).supervisor?.name ?? undefined,
        gradedAt:  assessment?.graded_at ?? undefined,
      };
    }

    return {
      groupId,
      groupName: `${(group as any).group_code} - ${(group as any).project_name}`,
      course: mapCourseCode(toDbCourseCode(courseCode)) as 'CPIS-498' | 'CPIS-499',
      students: students.map((m: any) => ({
        id: m.student?.id ?? '',
        name: m.student?.name ?? '',
      })),
      supervisorName: (group as any).supervisor?.name ?? '',
      deliverables,
      deliverablesTotal,
      weeklyProgress: {
        score:            weeklySummary.cappedScore,      // capped weekly grade (0–22 or 0–20)
        maxScore:         weeklySummary.maxWeeklyMarks,   // 22 (499) or 20 (498)
        reportsSubmitted: weeklySummary.totalRaw,         // uncapped raw mark total
        totalReports:     weeklySummary.maxRaw,           // weeksOpened × 2
        // Extended summary for display components
        weeksOpened:      weeklySummary.weeksOpened,
        cappedScore:      weeklySummary.cappedScore,
        maxWeeklyMarks:   weeklySummary.maxWeeklyMarks,
        isAtCap:          weeklySummary.totalRaw >= weeklySummary.maxWeeklyMarks,
        weekMarks:        weeklySummary.weekMarks,
      } as any,
      supervisorAssessment,
    };
  } catch (error) {
    console.error('Error fetching group grade:', error);
    return null;
  }
}

// ─── getAllGroupGrades ────────────────────────────────────────────────────────

export async function getAllGroupGrades(
  courseCode?: string,
  semester = 'DEFAULT'
): Promise<GroupGrade[]> {
  try {
    let groupQuery = supabase
      .from('groups')
      .select('id')
      .order('group_code');

    if (courseCode) {
      const courseId = await getCourseIdByCode(courseCode);
      if (courseId) groupQuery = groupQuery.eq('course_id', courseId);
    }

    const { data: groups } = await groupQuery;
    if (!groups || groups.length === 0) return [];

    const code = courseCode ?? 'CPIS-498';
    const results: GroupGrade[] = [];
    for (const g of groups) {
      const grade = await getGroupGrade(g.id, code, semester);
      if (grade) results.push(grade);
    }
    return results;
  } catch (error) {
    console.error('Error fetching all group grades:', error);
    return [];
  }
}

// ─── getStudentGrade ──────────────────────────────────────────────────────────

export async function getStudentGrade(
  studentId: string,
  courseCode: string,
  semester = 'DEFAULT'
): Promise<StudentGrade | null> {
  try {
    const courseId = await getCourseIdByCode(courseCode);
    if (!courseId) return null;

    const courseType = courseTypeFromCode(courseCode);

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', studentId)
      .single();

    if (!profile) return null;

    // Student's group
    const { data: membership } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('student_id', studentId)
      .limit(1)
      .maybeSingle();

    const groupId = membership?.group_id;

    // Supervisor assessment
    const { data: supAssessment } = await supabase
      .from('supervisor_assessments')
      .select('*, grader:profiles!graded_by(name)')
      .eq('student_id', studentId)
      .eq('course_id', courseId)
      .maybeSingle();

    // Committee evaluation (40%)
    const { data: commEvals } = await supabase
      .from('committee_evaluations')
      .select('*, evaluator:profiles!evaluator_id(name)')
      .eq('student_id', studentId)
      .eq('course_id', courseId);

    // Peer evaluations (CPIS-498 only)
    let peerScore: number | undefined;
    if (courseType === '498') {
      const { data: peerEvals } = await supabase
        .from('peer_evaluations')
        .select('*, evaluator:profiles!evaluator_id(name)')
        .eq('student_id', studentId)
        .eq('course_id', courseId);

      peerScore = peerEvals && peerEvals.length > 0
        ? peerEvals.reduce((sum: number, e: any) => sum + Number(e.score), 0) / peerEvals.length
        : undefined;
    }

    // Group-level grades
    let deliverablesTotal: number | undefined;
    let weeklyProgressScore: number | undefined;

    let weeklyMaxMarks = courseType === '499' ? 22 : 20;
    let weekMarks: Record<number, { studentMark: number; supervisorMark: number }> | undefined;
    let weeklyTotalRaw: number | undefined;
    let weeklyIsAtCap = false;

    if (groupId) {
      const groupGrade = await getGroupGrade(groupId, courseCode, semester);
      // Deliverables only for CPIS-498
      if (courseType === '498') {
        deliverablesTotal = groupGrade?.deliverablesTotal;
      }
      weeklyProgressScore = groupGrade?.weeklyProgress.score;
      weeklyMaxMarks     = (groupGrade?.weeklyProgress as any)?.maxWeeklyMarks ?? weeklyMaxMarks;
      weekMarks          = (groupGrade?.weeklyProgress as any)?.weekMarks;
      weeklyTotalRaw     = (groupGrade?.weeklyProgress as any)?.reportsSubmitted;
      weeklyIsAtCap      = (groupGrade?.weeklyProgress as any)?.isAtCap ?? false;
    }

    const schemas = await getGradingSchemas(courseType, semester);

    const supScore = supAssessment ? Number(supAssessment.score) : undefined;
    const commScore = commEvals && commEvals.length > 0
      ? commEvals.reduce((sum: number, e: any) => sum + Number(e.score), 0) / commEvals.length
      : undefined;

    // Total — only sum defined components to avoid inflating score with zeroes
    const totalScore =
      (supScore           ?? 0) +
      (commScore          ?? 0) +
      (peerScore          ?? 0) +
      (deliverablesTotal  ?? 0) +
      (weeklyProgressScore ?? 0);

    const finalGradeLetterOf = (score: number) =>
      score >= 95 ? 'A+' : score >= 90 ? 'A' : score >= 85 ? 'B+'
      : score >= 80 ? 'B' : score >= 75 ? 'C+' : score >= 70 ? 'C'
      : score >= 65 ? 'D+' : score >= 60 ? 'D' : score > 0 ? 'F' : 'In Progress';

    return {
      studentId,
      studentName: profile.name,
      groupId: groupId ?? '',
      course: courseCode as 'CPIS-498' | 'CPIS-499',
      supervisorAssessment: {
        score:    supScore,
        maxScore: courseType === '499' ? 23 : 20,
        comment:  supAssessment?.comment ?? undefined,
        gradedBy: supAssessment?.grader?.name ?? undefined,
        gradedAt: supAssessment?.graded_at ?? undefined,
      },
      committeeEvaluation: {
        score:         commScore,
        maxScore:      40 as const,
        evaluatorName: commEvals?.[0]?.evaluator?.name ?? undefined,
        comment:       commEvals?.[0]?.comment ?? undefined,
        evaluatedAt:   commEvals?.[0]?.evaluated_at ?? undefined,
      },
      peerFeedback: {
        score:    peerScore,
        maxScore: 5 as const,
      },
      deliverablesTotal,
      weeklyProgressScore,
      totalScore,
      finalGrade: finalGradeLetterOf(totalScore),
      // Extended weekly fields for detailed display
      _weeklyMaxMarks:   weeklyMaxMarks,
      _weeklyTotalRaw:   weeklyTotalRaw,
      _weeklyIsAtCap:    weeklyIsAtCap,
      _weekMarks:        weekMarks,
      // Pass through schema weights for rendering
      _schemas: schemas,
    } as any;
  } catch (error) {
    console.error('Error fetching student grade:', error);
    return null;
  }
}

// ─── Grade mutation functions (unchanged signatures) ─────────────────────────

export async function updateDeliverableGrade(
  groupId: string,
  courseCode: string,
  deliverableKey: string,
  score: number,
  maxScore: number,
  status: string,
  gradedBy: string
): Promise<void> {
  const courseId = await getCourseIdByCode(courseCode);
  if (!courseId) throw new Error('Course not found');

  const { error } = await supabase
    .from('group_deliverable_grades')
    .upsert({
      group_id:        groupId,
      course_id:       courseId,
      deliverable_key: deliverableKey,
      score,
      max_score:       maxScore,
      status: status === 'graded' ? 'graded' : status === 'submitted' ? 'submitted' : 'not_submitted',
      graded_by:       gradedBy,
      graded_at:       new Date().toISOString(),
    }, { onConflict: 'group_id,course_id,deliverable_key' });

  if (error) throw error;
}

export async function updateSupervisorAssessment(
  studentId: string,
  groupId: string,
  courseCode: string,
  score: number,
  comment: string,
  gradedBy: string
): Promise<void> {
  const courseId = await getCourseIdByCode(courseCode);
  if (!courseId) throw new Error('Course not found');

  const courseType = courseTypeFromCode(courseCode);
  const maxScore = courseType === '499' ? 23 : 20;

  const { error } = await supabase
    .from('supervisor_assessments')
    .upsert({
      student_id: studentId,
      group_id:   groupId,
      course_id:  courseId,
      score,
      max_score:  maxScore,
      comment,
      graded_by:  gradedBy,
    }, { onConflict: 'student_id,group_id,course_id' });

  if (error) throw error;
}

export async function createCommitteeEvaluation(evaluation: {
  studentId: string;
  groupId: string;
  courseCode: string;
  score: number;
  evaluatorId: string;
  comment?: string;
}): Promise<void> {
  const courseId = await getCourseIdByCode(evaluation.courseCode);
  if (!courseId) throw new Error('Course not found');

  const { error } = await supabase
    .from('committee_evaluations')
    .upsert({
      student_id:   evaluation.studentId,
      group_id:     evaluation.groupId,
      course_id:    courseId,
      score:        evaluation.score,
      max_score:    40,
      evaluator_id: evaluation.evaluatorId,
      comment:      evaluation.comment ?? null,
    }, { onConflict: 'student_id,group_id,course_id,evaluator_id' });

  if (error) throw error;
}

export async function createPeerEvaluation(evaluation: {
  studentId: string;
  evaluatorId: string;
  groupId: string;
  courseCode: string;
  score: number;
  comment?: string;
}): Promise<void> {
  const courseId = await getCourseIdByCode(evaluation.courseCode);
  if (!courseId) throw new Error('Course not found');

  const { error } = await supabase
    .from('peer_evaluations')
    .upsert({
      student_id:   evaluation.studentId,
      evaluator_id: evaluation.evaluatorId,
      group_id:     evaluation.groupId,
      course_id:    courseId,
      score:        evaluation.score,
      max_score:    5,
      comment:      evaluation.comment ?? null,
    }, { onConflict: 'student_id,evaluator_id,group_id,course_id' });

  if (error) throw error;
}
