import { supabase } from '../lib/supabase';
import type { Milestone, MilestoneConfig, RubricCriterion } from '../types';
import { mapMilestoneType, mapCourseCode, mapSubmissionStatus, toDbCourseCode, toDbMilestoneType } from './mappers';

function mapDbRubric(data: any): RubricCriterion {
  return {
    id: data.id,
    name: data.name,
    maxScore: data.max_score,
  };
}

function mapDbMilestone(data: any): Milestone {
  return {
    id: data.id,
    name: data.name,
    type: mapMilestoneType(data.type),
    course: data.course ? mapCourseCode(data.course.code) : mapCourseCode(data.type),
    openDate: data.open_date,
    dueDate: data.due_date,
    status: 'draft', // default; overridden when joined with submissions
    description: data.description ?? undefined,
    rubric: (data.rubric_criteria || [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(mapDbRubric),
  };
}

function mapDbMilestoneConfig(data: any): MilestoneConfig {
  return {
    id: data.id,
    name: data.name,
    course: data.course ? mapCourseCode(data.course.code) : 'CPIS-498',
    openDate: data.open_date,
    closeDate: data.due_date,
    visible: data.visible ?? true,
    allowLateSubmission: data.allow_late_submission ?? false,
    requireJustification: data.require_justification ?? false,
  };
}

export async function getMilestones(courseCode?: string): Promise<Milestone[]> {
  try {
    let query = supabase
      .from('milestones')
      .select('*, course:courses!course_id(code), rubric_criteria(id, name, max_score, sort_order)')
      .order('due_date');

    if (courseCode) {
      // Filter by joining courses table
      const dbCode = toDbCourseCode(courseCode);
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('code', dbCode);
      const courseIds = (courses || []).map((c: any) => c.id);
      if (courseIds.length > 0) {
        query = query.in('course_id', courseIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDbMilestone);
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }
}

export async function getMilestonesByStudentWithStatus(studentId: string): Promise<Milestone[]> {
  try {
    // Fetch all visible milestones
    const { data: milestones, error: mError } = await supabase
      .from('milestones')
      .select('*, course:courses!course_id(code), rubric_criteria(id, name, max_score, sort_order)')
      .eq('visible', true)
      .order('due_date');

    if (mError) throw mError;

    // Fetch student's submissions to determine status per milestone
    const { data: submissions, error: sError } = await supabase
      .from('submissions')
      .select('milestone_id, status')
      .eq('student_id', studentId);

    if (sError) throw sError;

    const submissionMap = new Map<string, string>();
    (submissions || []).forEach((s: any) => {
      submissionMap.set(s.milestone_id, s.status);
    });

    return (milestones || []).map((m: any) => {
      const mapped = mapDbMilestone(m);
      const subStatus = submissionMap.get(m.id);
      if (subStatus) {
        mapped.status = mapSubmissionStatus(subStatus);
      }
      return mapped;
    });
  } catch (error) {
    console.error('Error fetching milestones with status:', error);
    return [];
  }
}

export async function getMilestoneById(id: string): Promise<Milestone | null> {
  try {
    const { data, error } = await supabase
      .from('milestones')
      .select('*, course:courses!course_id(code), rubric_criteria(id, name, max_score, sort_order)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data ? mapDbMilestone(data) : null;
  } catch (error) {
    console.error('Error fetching milestone:', error);
    return null;
  }
}

export async function getMilestoneConfigs(courseCode?: string): Promise<MilestoneConfig[]> {
  try {
    let query = supabase
      .from('milestones')
      .select('*, course:courses!course_id(code)')
      .order('due_date');

    if (courseCode) {
      const dbCode = toDbCourseCode(courseCode);
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('code', dbCode);
      const courseIds = (courses || []).map((c: any) => c.id);
      if (courseIds.length > 0) {
        query = query.in('course_id', courseIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(mapDbMilestoneConfig);
  } catch (error) {
    console.error('Error fetching milestone configs:', error);
    return [];
  }
}

export async function createMilestone(config: Omit<MilestoneConfig, 'id'> & { type?: string }): Promise<void> {
  // Look up course_id from course code
  const dbCode = toDbCourseCode(config.course);
  const { data: courses } = await supabase
    .from('courses')
    .select('id')
    .eq('code', dbCode)
    .limit(1);

  const courseId = courses?.[0]?.id;
  if (!courseId) throw new Error(`Course ${config.course} not found`);

  const { error } = await supabase.from('milestones').insert({
    name: config.name,
    type: toDbMilestoneType(config.type ?? 'chapter'),
    course_id: courseId,
    open_date: config.openDate,
    due_date: config.closeDate,
    visible: config.visible,
    allow_late_submission: config.allowLateSubmission,
    require_justification: config.requireJustification,
  });

  if (error) throw error;
}

export async function updateMilestone(id: string, updates: Partial<MilestoneConfig>): Promise<void> {
  const dbUpdates: Record<string, any> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.openDate !== undefined) dbUpdates.open_date = updates.openDate;
  if (updates.closeDate !== undefined) dbUpdates.due_date = updates.closeDate;
  if (updates.visible !== undefined) dbUpdates.visible = updates.visible;
  if (updates.allowLateSubmission !== undefined) dbUpdates.allow_late_submission = updates.allowLateSubmission;
  if (updates.requireJustification !== undefined) dbUpdates.require_justification = updates.requireJustification;

  const { error } = await supabase
    .from('milestones')
    .update(dbUpdates)
    .eq('id', id);

  if (error) throw error;
}
