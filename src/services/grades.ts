import { supabase } from '../lib/supabase';
import type { GroupGrade, StudentGrade } from '../types';
import { mapCourseCode, mapDeliverableStatus, toDbCourseCode } from './mappers';

const DELIVERABLE_KEYS = ['chapter1', 'chapter2', 'chapter3', 'chapter4', 'finalReport', 'revisedFinalReport', 'presentation'] as const;
const DELIVERABLE_MAX_SCORES: Record<string, number> = {
  chapter1: 5, chapter2: 1, chapter3: 1, chapter4: 3,
  finalReport: 3, revisedFinalReport: 3, presentation: 0,
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

export async function getGroupGrade(groupId: string, courseCode: string): Promise<GroupGrade | null> {
  try {
    const courseId = await getCourseIdByCode(courseCode);
    if (!courseId) return null;

    // Fetch group info
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

    // Fetch deliverable grades
    const { data: deliverableGrades } = await supabase
      .from('group_deliverable_grades')
      .select('*')
      .eq('group_id', groupId)
      .eq('course_id', courseId);

    const deliverableMap = new Map<string, any>();
    (deliverableGrades || []).forEach((d: any) => deliverableMap.set(d.deliverable_key, d));

    // Build deliverables object
    const deliverables: any = {};
    let deliverablesTotal = 0;
    for (const key of DELIVERABLE_KEYS) {
      const grade = deliverableMap.get(key);
      const maxScore = DELIVERABLE_MAX_SCORES[key] ?? 0;
      if (grade) {
        const score = grade.score != null ? Number(grade.score) : undefined;
        deliverables[key] = {
          score,
          maxScore,
          status: mapDeliverableStatus(grade.status),
        };
        if (score != null) deliverablesTotal += score;
      } else {
        deliverables[key] = { maxScore, status: 'not-submitted' as const };
      }
    }

    // Fetch weekly reports count
    const { count: reportsSubmitted } = await supabase
      .from('weekly_reports')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .eq('course_id', courseId);

    const totalReports = 14;
    const weeklyScore = totalReports > 0
      ? ((reportsSubmitted ?? 0) / totalReports) * 20
      : 0;

    // Fetch supervisor assessments
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
        score: assessment ? Number(assessment.score) : undefined,
        maxScore: 20 as const,
        comment: assessment?.comment ?? undefined,
        gradedBy: assessment?.grader?.name ?? (group as any).supervisor?.name ?? undefined,
        gradedAt: assessment?.graded_at ?? undefined,
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
        score: Math.round(weeklyScore * 10) / 10,
        maxScore: 20 as const,
        reportsSubmitted: reportsSubmitted ?? 0,
        totalReports,
      },
      supervisorAssessment,
    };
  } catch (error) {
    console.error('Error fetching group grade:', error);
    return null;
  }
}

export async function getAllGroupGrades(courseCode?: string): Promise<GroupGrade[]> {
  try {
    let groupQuery = supabase
      .from('groups')
      .select('id')
      .order('group_code');

    if (courseCode) {
      const courseId = await getCourseIdByCode(courseCode);
      if (courseId) {
        groupQuery = groupQuery.eq('course_id', courseId);
      }
    }

    const { data: groups } = await groupQuery;
    if (!groups || groups.length === 0) return [];

    const results: GroupGrade[] = [];
    const code = courseCode ?? 'CPIS-498';
    for (const g of groups) {
      const grade = await getGroupGrade(g.id, code);
      if (grade) results.push(grade);
    }
    return results;
  } catch (error) {
    console.error('Error fetching all group grades:', error);
    return [];
  }
}

export async function getStudentGrade(studentId: string, courseCode: string): Promise<StudentGrade | null> {
  try {
    const courseId = await getCourseIdByCode(courseCode);
    if (!courseId) return null;

    // Get student profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name')
      .eq('id', studentId)
      .single();

    if (!profile) return null;

    // Get student's group
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

    // Committee evaluation
    const { data: commEvals } = await supabase
      .from('committee_evaluations')
      .select('*, evaluator:profiles!evaluator_id(name)')
      .eq('student_id', studentId)
      .eq('course_id', courseId);

    // Peer evaluations
    const { data: peerEvals } = await supabase
      .from('peer_evaluations')
      .select('*, evaluator:profiles!evaluator_id(name)')
      .eq('student_id', studentId)
      .eq('course_id', courseId);

    // Group grade for deliverables & weekly
    let deliverablesTotal: number | undefined;
    let weeklyProgressScore: number | undefined;
    if (groupId) {
      const groupGrade = await getGroupGrade(groupId, courseCode);
      deliverablesTotal = groupGrade?.deliverablesTotal;
      weeklyProgressScore = groupGrade?.weeklyProgress.score;
    }

    const supScore = supAssessment ? Number(supAssessment.score) : undefined;
    const commScore = commEvals && commEvals.length > 0
      ? commEvals.reduce((sum: number, e: any) => sum + Number(e.score), 0) / commEvals.length
      : undefined;
    const peerScore = peerEvals && peerEvals.length > 0
      ? peerEvals.reduce((sum: number, e: any) => sum + Number(e.score), 0) / peerEvals.length
      : undefined;

    const totalScore = (supScore ?? 0) + (commScore ?? 0) + (peerScore ?? 0)
      + (deliverablesTotal ?? 0) + (weeklyProgressScore ?? 0);

    return {
      studentId,
      studentName: profile.name,
      groupId: groupId ?? '',
      course: courseCode as 'CPIS-498' | 'CPIS-499',
      supervisorAssessment: {
        score: supScore,
        maxScore: 20 as const,
        comment: supAssessment?.comment ?? undefined,
        gradedBy: supAssessment?.grader?.name ?? undefined,
        gradedAt: supAssessment?.graded_at ?? undefined,
      },
      committeeEvaluation: {
        score: commScore,
        maxScore: 40 as const,
        evaluatorName: commEvals?.[0]?.evaluator?.name ?? undefined,
        comment: commEvals?.[0]?.comment ?? undefined,
        evaluatedAt: commEvals?.[0]?.evaluated_at ?? undefined,
      },
      peerFeedback: {
        score: peerScore,
        maxScore: 5 as const,
      },
      deliverablesTotal,
      weeklyProgressScore,
      totalScore,
      finalGrade: totalScore >= 95 ? 'A+' : totalScore >= 90 ? 'A' : totalScore >= 85 ? 'B+'
        : totalScore >= 80 ? 'B' : totalScore >= 75 ? 'C+' : totalScore >= 70 ? 'C'
        : totalScore >= 65 ? 'D+' : totalScore >= 60 ? 'D' : totalScore > 0 ? 'F' : 'In Progress',
    };
  } catch (error) {
    console.error('Error fetching student grade:', error);
    return null;
  }
}

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
      group_id: groupId,
      course_id: courseId,
      deliverable_key: deliverableKey,
      score,
      max_score: maxScore,
      status: status === 'graded' ? 'graded' : status === 'submitted' ? 'submitted' : 'not_submitted',
      graded_by: gradedBy,
      graded_at: new Date().toISOString(),
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

  const { error } = await supabase
    .from('supervisor_assessments')
    .upsert({
      student_id: studentId,
      group_id: groupId,
      course_id: courseId,
      score,
      max_score: 20,
      comment,
      graded_by: gradedBy,
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
      student_id: evaluation.studentId,
      group_id: evaluation.groupId,
      course_id: courseId,
      score: evaluation.score,
      max_score: 40,
      evaluator_id: evaluation.evaluatorId,
      comment: evaluation.comment ?? null,
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
      student_id: evaluation.studentId,
      evaluator_id: evaluation.evaluatorId,
      group_id: evaluation.groupId,
      course_id: courseId,
      score: evaluation.score,
      max_score: 5,
      comment: evaluation.comment ?? null,
    }, { onConflict: 'student_id,evaluator_id,group_id,course_id' });

  if (error) throw error;
}
