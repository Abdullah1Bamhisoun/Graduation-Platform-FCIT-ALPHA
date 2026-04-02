import { supabase } from '../lib/supabase';
import { apiUrl } from '@/lib/api';

export interface GroupFile {
  id: string;
  groupId: string;
  courseId: string | null;
  uploadedBy: string;
  uploaderName: string;
  uploaderRole: 'student' | 'supervisor' | 'committee' | 'coordinator';
  fileName: string;
  fileSize: number | null;
  filePath: string;
  targetRole: 'supervisor' | 'committee' | 'coordinator' | 'all' | null;
  submitToCommittee: boolean;
  versionNumber: number;
  parentFileId: string | null;
  courseNumber: string | null;
  notes: string | null;
  uploadedAt: string;
}

export interface PreviousCommitteeFeedback {
  previousGroup: {
    id: string;
    groupNumber: number | null;
    courseNumber: string | null;
  } | null;
  scores: Array<{
    criterionKey: string;
    score: number;
    evaluatorId: string;
    evaluatorName: string;
    submissionStatus: string;
  }>;
  comments: Array<{
    id: string;
    milestoneId: string;
    evaluatorId: string;
    evaluatorName: string;
    comment: string;
    createdAt: string;
  }>;
  files: GroupFile[];
}

async function getAuthHeaders(activeRole?: string): Promise<Record<string, string>> {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token ?? '';
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (activeRole) headers['X-Active-Role'] = activeRole;
  return headers;
}

/**
 * Fetch files for a group, optionally filtered to committee-targeted files only.
 */
export async function getGroupFiles(
  groupId: string,
  options: {
    committeeOnly?: boolean;
    courseNumber?: string;
    activeRole?: string;
  } = {}
): Promise<GroupFile[]> {
  try {
    const headers = await getAuthHeaders(options.activeRole);
    const params = new URLSearchParams();
    if (options.committeeOnly) params.set('committee', 'true');
    if (options.courseNumber) params.set('courseNumber', options.courseNumber);

    const query = params.toString() ? `?${params.toString()}` : '';
    const response = await fetch(apiUrl(`/api/groups/${groupId}/files${query}`), { headers });

    if (!response.ok) {
      console.error('getGroupFiles error:', response.status);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching group files:', error);
    return [];
  }
}

/**
 * Register a file upload for a group (call after uploading to Supabase Storage).
 */
export async function createGroupFile(
  groupId: string,
  params: {
    fileName: string;
    fileSize?: number;
    filePath: string;
    targetRole?: 'supervisor' | 'committee' | 'coordinator' | 'all';
    submitToCommittee?: boolean;
    courseId?: string;
    courseNumber?: string;
    notes?: string;
    parentFileId?: string;
  },
  activeRole?: string
): Promise<{ id: string; uploadedAt: string; versionNumber: number }> {
  const headers = await getAuthHeaders(activeRole);
  const response = await fetch(apiUrl(`/api/groups/${groupId}/files`), {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to register group file');
  }
  return response.json();
}

/**
 * Fetch previous committee feedback (CPIS-498) for a CPIS-499 group.
 */
export async function getPreviousCommitteeFeedback(
  groupId: string,
  activeRole?: string
): Promise<PreviousCommitteeFeedback> {
  try {
    const headers = await getAuthHeaders(activeRole);
    const response = await fetch(apiUrl(`/api/groups/${groupId}/previous-committee-feedback`), { headers });

    if (!response.ok) {
      console.error('getPreviousCommitteeFeedback error:', response.status);
      return { previousGroup: null, scores: [], comments: [], files: [] };
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching previous committee feedback:', error);
    return { previousGroup: null, scores: [], comments: [], files: [] };
  }
}

export interface CommitteeEvalSubmission {
  milestoneId: string;
  milestoneName: string;
  dueDate: string | null;
  submissionId: string | null;
  status: string | null;
  submitterName: string | null;
  submittedAt: string | null;
  latestVersion: {
    version: number;
    fileName: string;
    fileSize: number | null;
    filePath: string;
    uploadedAt: string;
    notes: string | null;
  } | null;
}

/**
 * Fetch milestone submissions flagged for committee evaluation for a group.
 * Returns one entry per committee-eval milestone (with or without a submission).
 */
export async function getCommitteeEvalSubmissions(
  groupId: string,
  activeRole?: string
): Promise<CommitteeEvalSubmission[]> {
  try {
    const headers = await getAuthHeaders(activeRole);
    const response = await fetch(apiUrl(`/api/submissions/committee-eval?groupId=${groupId}`), { headers });
    if (!response.ok) {
      console.error('getCommitteeEvalSubmissions error:', response.status);
      return [];
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching committee eval submissions:', error);
    return [];
  }
}

/** Role badge label and colour for a given uploader role. */
export function getRoleBadge(role: GroupFile['uploaderRole'] | string): {
  label: string;
  className: string;
} {
  switch (role) {
    case 'committee':
      return { label: 'Committee', className: 'bg-purple-100 text-purple-700 border border-purple-200' };
    case 'supervisor':
      return { label: 'Supervisor', className: 'bg-blue-100 text-blue-700 border border-blue-200' };
    case 'coordinator':
      return { label: 'Coordinator', className: 'bg-orange-100 text-orange-700 border border-orange-200' };
    case 'student':
      return { label: 'Student', className: 'bg-green-100 text-green-700 border border-green-200' };
    default:
      return { label: role, className: 'bg-gray-100 text-gray-700 border border-gray-200' };
  }
}
