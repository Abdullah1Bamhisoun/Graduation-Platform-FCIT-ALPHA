import { supabase } from '../lib/supabase';
import type { LateRequest } from '../types';

function mapRow(row: any): LateRequest {
  return {
    id:          row.id,
    groupId:     row.group_id,
    weekNumber:  row.week_number,
    courseType:  row.course_type as '498' | '499',
    department:  row.department,
    semester:    row.semester,
    status:      row.status as 'pending' | 'approved' | 'rejected',
    reason:      row.reason ?? undefined,
    requestedAt: row.requested_at,
    requestedBy: row.requested_by ?? undefined,
    reviewedBy:  row.reviewed_by ?? undefined,
    reviewedAt:  row.reviewed_at ?? undefined,
  };
}

/**
 * Student / group submits a late submission request.
 * Rules:
 *  - Only one request per group per week per semester (UNIQUE constraint).
 *  - Cannot request if the week is locked.
 */
export async function submitLateRequest(params: {
  groupId: string;
  weekNumber: number;
  courseType: '498' | '499';
  semester: string;
  reason?: string;
  requestedBy: string;
  department?: string;
}): Promise<void> {
  const department = params.department ?? 'IS';

  // Guard: check week is not locked
  const { data: ws } = await supabase
    .from('week_statuses')
    .select('is_locked')
    .eq('department', department)
    .eq('course_type', params.courseType)
    .eq('week_number', params.weekNumber)
    .eq('semester', params.semester)
    .maybeSingle();

  // Also check DEFAULT fallback
  if (!ws) {
    const { data: wsDef } = await supabase
      .from('week_statuses')
      .select('is_locked')
      .eq('department', department)
      .eq('course_type', params.courseType)
      .eq('week_number', params.weekNumber)
      .eq('semester', 'DEFAULT')
      .maybeSingle();
    if (wsDef?.is_locked) {
      throw new Error('Cannot submit a late request for a locked week.');
    }
  } else if (ws.is_locked) {
    throw new Error('Cannot submit a late request for a locked week.');
  }

  const { error } = await supabase.from('late_requests').insert({
    group_id:     params.groupId,
    week_number:  params.weekNumber,
    course_type:  params.courseType,
    department,
    semester:     params.semester,
    reason:       params.reason ?? null,
    requested_by: params.requestedBy,
    status:       'pending',
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('A late request for this week already exists.');
    }
    throw error;
  }
}

/** Coordinator: fetch all late requests for a course + semester. */
export async function getLateRequests(
  courseType: '498' | '499',
  semester: string,
  department = 'IS'
): Promise<LateRequest[]> {
  const { data, error } = await supabase
    .from('late_requests')
    .select('*')
    .eq('course_type', courseType)
    .eq('department', department)
    .eq('semester', semester)
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Student / supervisor: fetch requests for a specific group. */
export async function getGroupLateRequests(
  groupId: string,
  semester: string
): Promise<LateRequest[]> {
  const { data, error } = await supabase
    .from('late_requests')
    .select('*')
    .eq('group_id', groupId)
    .eq('semester', semester)
    .order('requested_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Coordinator: approve a late request. */
export async function approveLateRequest(
  requestId: string,
  reviewerId: string
): Promise<void> {
  const { error } = await supabase
    .from('late_requests')
    .update({
      status:      'approved',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) throw error;
}

/** Coordinator: reject a late request. */
export async function rejectLateRequest(
  requestId: string,
  reviewerId: string
): Promise<void> {
  const { error } = await supabase
    .from('late_requests')
    .update({
      status:      'rejected',
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('status', 'pending');

  if (error) throw error;
}
