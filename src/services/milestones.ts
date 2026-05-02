import { supabase } from '../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import type { Milestone, MilestoneConfig, RubricCriterion } from '../types';
import { mapMilestoneType, mapCourseCode, mapSubmissionStatus } from './mappers';

// ─── Module-level cache ───────────────────────────────────────────────────────

const MILESTONES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> { data: T; fetchedAt: number }

const _milestonesCache    = new Map<string, CacheEntry<Milestone[]>>();
const _studentCache       = new Map<string, CacheEntry<Milestone[]>>();
const _configsCache       = new Map<string, CacheEntry<MilestoneConfig[]>>();

function _isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return !!entry && Date.now() - entry.fetchedAt < MILESTONES_CACHE_TTL;
}

export function clearMilestonesCache() {
  _milestonesCache.clear();
  _studentCache.clear();
  _configsCache.clear();
}

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
    allowLateSubmission: data.allow_late_submission ?? false,
    rubric: (data.rubric_criteria || [])
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(mapDbRubric),
  };
}

function mapApiMilestoneConfig(data: any): MilestoneConfig {
  return {
    id:                   data.id,
    name:                 data.name,
    course:               mapCourseCode(data.courseCode ?? ''),
    courseId:             data.courseId,
    openDate:             data.openDate,
    closeDate:            data.dueDate,
    visible:              data.visible ?? true,
    allowLateSubmission:  data.allowLateSubmission ?? false,
    requireJustification: data.requireJustification ?? false,
    description:          data.description ?? '',
    gradingCriterionId:     data.gradingCriterionId ?? undefined,
    gradingCriterionKey:    data.gradingCriterionKey ?? undefined,
    gradingCriterionName:   data.gradingCriterionName ?? undefined,
    gradingCriterionMax:    data.gradingCriterionMax ?? undefined,
    includeInCommitteeEval: data.includeInCommitteeEval ?? false,
    allowedFileType:        data.allowedFileType ?? undefined,
  };
}

/** Fetch milestones directly from Supabase (used by student view). */
export async function getMilestones(courseCode?: string): Promise<Milestone[]> {
  const key = courseCode ?? '';
  const cached = _milestonesCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    let query = supabase
      .from('milestones')
      .select('*, course:courses!course_id(code), rubric_criteria(id, name, max_score, sort_order)')
      .order('due_date');

    if (courseCode) {
      const { data: courses } = await supabase
        .from('courses')
        .select('id')
        .eq('code', courseCode);
      const courseIds = (courses || []).map((c: any) => c.id);
      if (courseIds.length > 0) {
        query = query.in('course_id', courseIds);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    const result = (data || []).map(mapDbMilestone);
    _milestonesCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }
}

/**
 * Fetch visible milestones for a student, filtered to their course only.
 * Students without a group see no milestones (empty array).
 */
export async function getMilestonesByStudentWithStatus(
  studentId: string,
  opts?: { groupId?: string; courseId?: string },
): Promise<Milestone[]> {
  const cached = _studentCache.get(studentId);
  if (_isFresh(cached)) return cached.data;

  try {
    // Use caller-supplied group/course IDs when available to avoid redundant queries.
    let groupId: string | null = opts?.groupId ?? null;
    let courseId: string | null = opts?.courseId ?? null;

    if (!groupId) {
      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', studentId)
        .limit(1)
        .maybeSingle();
      groupId = membership?.group_id ?? null;
    }

    if (!courseId && groupId) {
      const { data: group } = await supabase
        .from('groups')
        .select('course_id')
        .eq('id', groupId)
        .single();
      courseId = group?.course_id ?? null;
    }

    // No group → no milestones
    if (!courseId || !groupId) return [];

    // Fetch milestones and submission statuses in parallel — both only need
    // groupId/courseId which are already known at this point.
    const sessionProm = supabase.auth.getSession();
    const [{ data: milestones }, statusRes] = await Promise.all([
      supabase
        .from('milestones')
        .select('*, course:courses!course_id(code), rubric_criteria(id, name, max_score, sort_order)')
        .eq('visible', true)
        .eq('course_id', courseId)
        .order('due_date'),
      sessionProm.then(async (session) => {
        const token = session.data.session?.access_token ?? '';
        return apiFetch(
          apiUrl(`/api/submissions/group-milestone-statuses?groupId=${groupId}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }),
    ]);

    const submissionMap = new Map<string, string>();
    if (statusRes.ok) {
      const statuses: Record<string, string> = await statusRes.json();
      Object.entries(statuses).forEach(([milestoneId, status]) => {
        submissionMap.set(milestoneId, status);
      });
    }

    const result = (milestones || []).map((m: any) => {
      const mapped = mapDbMilestone(m);
      const subStatus = submissionMap.get(m.id);
      if (subStatus) {
        mapped.status = mapSubmissionStatus(subStatus);
      }
      return mapped;
    });
    _studentCache.set(studentId, { data: result, fetchedAt: Date.now() });
    return result;
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

/** Fetch milestone configs via the backend API (enforces coordinator course scope). */
export async function getMilestoneConfigs(courseId?: string): Promise<MilestoneConfig[]> {
  const key = courseId ?? '';
  const cached = _configsCache.get(key);
  if (_isFresh(cached)) return cached.data;

  try {
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const activeRole = session.data.session?.user
      ? (localStorage.getItem(`activeRole_${session.data.session.user.id}`) ?? 'coordinator')
      : 'coordinator';

    const params = new URLSearchParams();
    if (courseId) params.set('course_id', courseId);

    const response = await apiFetch(apiUrl(`/api/milestones?${params.toString()}`), {
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
        'X-Active-Role': activeRole,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to fetch milestone configs');
    }

    const data = await response.json();
    const result = (data || []).map(mapApiMilestoneConfig);
    _configsCache.set(key, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching milestone configs:', error);
    return [];
  }
}

/** Create a milestone via the backend API (validates course scope server-side). */
export async function createMilestone(config: Omit<MilestoneConfig, 'id'>): Promise<string> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const userId = session.data.session?.user?.id ?? '';
  const activeRole = localStorage.getItem(`activeRole_${userId}`) ?? 'coordinator';

  const response = await apiFetch(apiUrl('/api/milestones'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      'X-Active-Role': activeRole,
    },
    body: JSON.stringify({
      name:                 config.name,
      courseId:             config.courseId,
      openDate:             config.openDate,
      dueDate:              config.closeDate,
      visible:              config.visible,
      allowLateSubmission:  config.allowLateSubmission,
      requireJustification: config.requireJustification,
      description:          config.description ?? '',
      gradingCriterionId:   config.gradingCriterionId ?? null,
      includeInCommitteeEval: config.includeInCommitteeEval ?? false,
      allowedFileType:      config.allowedFileType ?? null,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to create milestone');
  }

  const data = await response.json();
  clearMilestonesCache();
  return data.id as string;
}

/** Update a milestone via the backend API (validates course scope server-side). */
export async function updateMilestone(id: string, updates: Partial<MilestoneConfig>): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const userId = session.data.session?.user?.id ?? '';
  const activeRole = localStorage.getItem(`activeRole_${userId}`) ?? 'coordinator';

  const response = await apiFetch(apiUrl(`/api/milestones/${id}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token ?? ''}`,
      'X-Active-Role': activeRole,
    },
    body: JSON.stringify({
      name:                 updates.name,
      openDate:             updates.openDate,
      closeDate:            updates.closeDate,
      visible:              updates.visible,
      allowLateSubmission:  updates.allowLateSubmission,
      requireJustification: updates.requireJustification,
      description:          updates.description,
      gradingCriterionId:     updates.gradingCriterionId ?? null,
      includeInCommitteeEval: updates.includeInCommitteeEval ?? false,
      allowedFileType:        updates.allowedFileType ?? null,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to update milestone');
  }
  clearMilestonesCache();
}

/** Delete a milestone via the backend API (also deletes its linked announcement). */
export async function deleteMilestone(id: string): Promise<void> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;
  const userId = session.data.session?.user?.id ?? '';
  const activeRole = localStorage.getItem(`activeRole_${userId}`) ?? 'coordinator';

  const response = await apiFetch(apiUrl(`/api/milestones/${id}`), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'X-Active-Role': activeRole,
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to delete milestone');
  }
  clearMilestonesCache();
}
