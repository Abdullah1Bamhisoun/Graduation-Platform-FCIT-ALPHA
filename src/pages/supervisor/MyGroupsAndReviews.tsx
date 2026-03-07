/**
 * SupervisorMyGroupsAndReviews
 *
 * Replaces the old "Chapter Grading" page with two distinct tabs:
 *
 *  Tab 1 — "My Groups"
 *    Displays every group assigned to the logged-in supervisor.
 *    Filtered by supervisor_id at the backend (Supabase query in getGroupsForSupervisor).
 *    Read-only: supervisors cannot edit group data here.
 *
 *  Tab 2 — "Chapter Submission"
 *    Lists all chapter submissions belonging to the supervisor's groups.
 *    Data is fetched from GET /api/submissions/chapter-submissions which
 *    enforces supervisor_id at the backend — supervisors can never see another
 *    supervisor's submissions.
 *    Supervisors can APPROVE or REJECT submissions with an optional/required comment.
 *    NO grading happens here — grading is entirely controlled by the Coordinator
 *    via the Grading Scheme Editor and is logically/structurally separate.
 *
 * Design:
 *    The Chapter Submission tab reuses the same table layout, card containers,
 *    status badge design, button styles, and right-sidebar pattern from the
 *    previous Chapter Grading page — only grading controls are replaced by
 *    approval/rejection controls.
 */

import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForSupervisor } from '../../services/groups';
import {
  CheckCircle,
  XCircle,
  FileText,
  Users,
  Clock,
  ChevronRight,
  AlertCircle,
  BookOpen,
  BarChart2,
  Award,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Loader2,
  Download,
  Eye,
  MessageSquare,
  Send,
} from 'lucide-react';
import { getSignedUrl } from '../../services/storage';
import { toast } from 'sonner';
import { useNavigate, useSearchParams } from 'react-router-dom';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Group {
  id: string;
  groupCode: string;
  groupNumber: number;
  course: string;
  projectTitle: string;
  students: { id: string; name: string }[];
  status: string;
}

interface ChapterSubmission {
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
  versions: { version: number; file_name: string; file_size: string; file_path: string | null; uploaded_at: string }[];
  hasFeedback: boolean;
  latestFeedback: { overall_comment: string; reviewed_at: string } | null;
}

interface GradeComponent {
  componentKey: string;
  componentName: string;
  totalMarks: number;
  evaluatorRole: string;
  score: number | null;
  maxScore: number;
}

interface SupervisorEvalEntry {
  studentId: string;
  score: number | null;
  maxScore: number;
  gradedAt: string | null;
  submissionStatus: string;
}

/**
 * Shape returned by GET /api/groups/supervisor-grades
 * Grades are read-only here — the Coordinator owns the grading scheme.
 */
interface GroupGradeData {
  id: string;
  groupNumber: number;
  groupCode: string | null;
  projectName: string;
  status: string;
  projectStatus: 'normal' | 'ip';
  ipMarkedAt: string | null;
  ipReason: string | null;
  courseCode: string;
  courseType: '498' | '499';
  courseId: string;
  students: { id: string; name: string }[];
  /** Grade components from grading_components — dynamically fetched, never hardcoded */
  components: GradeComponent[];
  deliverablesTotal: number;
  supervisorEvaluation: SupervisorEvalEntry[];
  supervisorTotalScore: number | null;
  supervisorMaxScore: number;
  /** Per-criterion rubric scores already saved by this supervisor */
  rubricScores: {
    studentId: string;
    criterionKey: string;
    rawScore: number;
    submissionStatus: string;
    gradedAt: string | null;
  }[];
  weeklyScore: number;
  approvalCounts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
  };
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchChapterSubmissions(token: string): Promise<ChapterSubmission[]> {
  try {
    const res = await fetch('/api/submissions/chapter-submissions', {
      headers: { Authorization: `Bearer ${token}`, 'X-Active-Role': 'supervisor' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    const { supabase } = await import('../../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: groups } = await supabase
      .from('groups').select('id, group_number, project_name').eq('supervisor_id', user.id);
    const groupIds = (groups || []).map((g: any) => g.id);
    if (groupIds.length === 0) return [];
    const groupMap = new Map((groups || []).map((g: any) => [g.id, g]));
    const { data: milestones } = await supabase.from('milestones').select('id, name, type, due_date');
    const milestoneMap = new Map((milestones || []).map((m: any) => [m.id, m]));
    const { data: subs } = await supabase
      .from('submissions')
      .select('*, student:profiles!student_id(name), versions:submission_versions(*)')
      .in('group_id', groupIds)
      .order('updated_at', { ascending: false });
    return (subs || []).map((s: any) => {
      const ms = milestoneMap.get(s.milestone_id) as any;
      const g = groupMap.get(s.group_id) as any;
      return {
        id: s.id, groupId: s.group_id, groupNumber: g?.group_number ?? null,
        projectName: g?.project_name ?? '', studentId: s.student_id,
        studentName: s.student?.name ?? '', milestoneId: s.milestone_id,
        milestoneName: ms?.name ?? '', milestoneType: ms?.type ?? '',
        dueDate: ms?.due_date ?? null, status: s.status,
        currentVersion: s.current_version, submittedAt: s.updated_at ?? s.created_at,
        versions: (s.versions || []).map((v: any) => ({
          version: v.version, file_name: v.file_name ?? '', file_size: v.file_size ?? '',
          file_path: v.file_path ?? null, uploaded_at: v.uploaded_at ?? '',
        })),
        hasFeedback: false, latestFeedback: null,
      };
    });
  }
}

async function submitApproval(
  submissionId: string,
  action: 'approve' | 'reject',
  feedback: string,
  token: string
): Promise<{ newStatus: string }> {
  const res = await fetch(`/api/submissions/${submissionId}/approval`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, feedback }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    const detail = err.detail ? ` (${err.detail})` : '';
    throw new Error((err.error || 'Failed to update submission') + detail);
  }
  return res.json();
}

/**
 * Fetches grade data for all groups assigned to the logged-in supervisor.
 * Backend enforces supervisor_id — no cross-supervisor access is possible.
 * Grading scheme (components/weights) is dynamically assembled server-side
 * from grading_components; this function never hardcodes any weight.
 */
async function fetchSupervisorGrades(token: string): Promise<GroupGradeData[]> {
  try {
    const res = await fetch('/api/groups/supervisor-grades', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    const { supabase } = await import('../../lib/supabase');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data: groups } = await supabase
      .from('groups')
      .select('*, course:courses!course_id(code, name), members:group_members(student:profiles!student_id(id, name))')
      .eq('supervisor_id', user.id);
    return (groups || []).map((g: any) => ({
      id: g.id, groupNumber: g.group_number, groupCode: g.group_code,
      projectName: g.project_name, status: g.status, projectStatus: 'normal' as const,
      ipMarkedAt: null, ipReason: null, courseCode: g.course?.code ?? '',
      courseType: '498' as const, courseId: g.course_id,
      students: (g.members || []).map((m: any) => ({ id: m.student?.id ?? '', name: m.student?.name ?? '' })),
      components: [], deliverablesTotal: 0, supervisorEvaluation: [],
      supervisorTotalScore: null, supervisorMaxScore: 0, rubricScores: [],
      weeklyScore: 0, approvalCounts: { total: 0, pending: 0, approved: 0, rejected: 0 },
    }));
  }
}

/**
 * Marks (or un-marks) a group's project_status as IP.
 * Backend validates supervisor ownership before accepting the update.
 */
async function requestMarkAsIP(
  groupId: string,
  status: 'ip' | 'normal',
  reason: string,
  token: string
): Promise<{ projectStatus: string }> {
  const res = await fetch(`/api/groups/${groupId}/project-status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status, reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to update project status');
  }
  return res.json();
}

// ─── Discussion / Comment types & helpers ─────────────────────────────────────

interface SubmissionComment {
  id: string;
  content: string;
  authorName: string;
  authorRole: 'student' | 'supervisor';
  createdAt: string;
}

async function fetchComments(submissionId: string, token: string): Promise<SubmissionComment[]> {
  try {
    const res = await fetch(`/api/submissions/${submissionId}/comments`, {
      headers: { Authorization: `Bearer ${token}`, 'X-Active-Role': 'supervisor' },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function postComment(submissionId: string, content: string, token: string): Promise<SubmissionComment> {
  const res = await fetch(`/api/submissions/${submissionId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Active-Role': 'supervisor',
    },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to post comment');
  }
  return res.json();
}

// ─── Status helpers (same palette as the old chapter submissions tab) ─────────

function getStatusColor(status: string): string {
  switch (status) {
    case 'approved':
      return 'text-green-600 bg-green-50 border-green-200';
    case 'submitted':
    case 'under-review':
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'changes-requested':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'draft':
      return 'text-gray-600 bg-gray-50 border-gray-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'approved':       return 'Approved';
    case 'submitted':      return 'Pending Review';
    case 'under-review':   return 'Under Review';
    case 'changes-requested': return 'Changes Requested';
    case 'draft':          return 'Draft';
    default:               return status;
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SupervisorMyGroupsAndReviews() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Top-level tab — read initial value from ?tab= query param
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') ?? 'my-groups');

  // Groups (Tab 1)
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Chapter submissions (Tab 2)
  const [submissions, setSubmissions] = useState<ChapterSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [filterGroup, setFilterGroup] = useState('all');

  // Approval dialogs
  const [approveTarget, setApproveTarget] = useState<ChapterSubmission | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<ChapterSubmission | null>(null);
  const [approveComment, setApproveComment] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [processing, setProcessing] = useState(false);

  // Grades tab (Tab 3)
  const [gradesData, setGradesData] = useState<GroupGradeData[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Mark as IP dialog
  const [ipTarget, setIpTarget] = useState<GroupGradeData | null>(null);
  const [ipReason, setIpReason] = useState('');
  const [ipProcessing, setIpProcessing] = useState(false);

  // File viewer modal
  const [viewModalOpen, setViewModalOpen]       = useState(false);
  const [viewModalUrl, setViewModalUrl]         = useState('');
  const [viewModalName, setViewModalName]       = useState('');
  const [viewModalLoading, setViewModalLoading] = useState(false);

  // Discussion dialog
  const [discussionTarget, setDiscussionTarget]     = useState<ChapterSubmission | null>(null);
  const [discussionComments, setDiscussionComments] = useState<SubmissionComment[]>([]);
  const [discussionLoading, setDiscussionLoading]   = useState(false);
  const [newDiscussionComment, setNewDiscussionComment] = useState('');
  const [discussionPosting, setDiscussionPosting]   = useState(false);

  // ── Load groups ───────────────────────────────────────────────────────────

  const loadGroups = useCallback(async () => {
    if (!user) return;
    setGroupsLoading(true);
    try {
      const data = await getGroupsForSupervisor(user.id);
      setGroups(
        data.map((g) => ({
          id: g.id,
          groupCode: g.groupCode,
          groupNumber: g.groupNumber ?? 0,
          course: g.courseCode,
          projectTitle: g.projectName,
          students: g.members.map((m) => ({ id: m.id, name: m.name })),
          status: g.status,
        }))
      );
    } catch {
      toast.error('Failed to load groups');
    } finally {
      setGroupsLoading(false);
    }
  }, [user?.id]);

  // ── Load submissions ──────────────────────────────────────────────────────

  const loadSubmissions = useCallback(async () => {
    if (!user) return;
    setSubmissionsLoading(true);
    try {
      const session = await import('../../lib/supabase').then((m) =>
        m.supabase.auth.getSession()
      );
      const token = session.data.session?.access_token ?? '';
      const data = await fetchChapterSubmissions(token);
      setSubmissions(data);
    } catch {
      toast.error('Failed to load chapter submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  }, [user?.id]);

  // ── Load grades (Tab 3) ───────────────────────────────────────────────────

  const loadGrades = useCallback(async () => {
    if (!user) return;
    setGradesLoading(true);
    try {
      const session = await import('../../lib/supabase').then((m) =>
        m.supabase.auth.getSession()
      );
      const token = session.data.session?.access_token ?? '';
      const data = await fetchSupervisorGrades(token);
      setGradesData(data);
    } catch {
      toast.error('Failed to load group grades');
    } finally {
      setGradesLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { loadGroups(); },      [loadGroups]);
  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);
  useEffect(() => { loadGrades(); },      [loadGrades]);

  // ── Filtered submissions ──────────────────────────────────────────────────

  const filteredSubmissions =
    filterGroup === 'all'
      ? submissions
      : submissions.filter((s) => s.groupId === filterGroup);

  const stats = {
    pending:  filteredSubmissions.filter((s) => ['submitted', 'under-review'].includes(s.status)).length,
    approved: filteredSubmissions.filter((s) => s.status === 'approved').length,
    rejected: filteredSubmissions.filter((s) => s.status === 'changes-requested').length,
  };

  // ── Approval handlers ─────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!approveTarget || !user) return;
    setProcessing(true);
    try {
      const session = await import('../../lib/supabase').then((m) =>
        m.supabase.auth.getSession()
      );
      const token = session.data.session?.access_token ?? '';
      await submitApproval(approveTarget.id, 'approve', approveComment.trim(), token);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === approveTarget.id ? { ...s, status: 'approved' } : s
        )
      );
      toast.success(`Submission approved for ${approveTarget.milestoneName}`);
      setApproveTarget(null);
      setApproveComment('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve submission');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !user) return;
    if (!rejectFeedback.trim()) {
      toast.error('Feedback is required when rejecting a submission');
      return;
    }
    setProcessing(true);
    try {
      const session = await import('../../lib/supabase').then((m) =>
        m.supabase.auth.getSession()
      );
      const token = session.data.session?.access_token ?? '';
      await submitApproval(rejectTarget.id, 'reject', rejectFeedback.trim(), token);
      setSubmissions((prev) =>
        prev.map((s) =>
          s.id === rejectTarget.id ? { ...s, status: 'changes-requested' } : s
        )
      );
      toast.success(`Changes requested for ${rejectTarget.milestoneName}`);
      setRejectTarget(null);
      setRejectFeedback('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject submission');
    } finally {
      setProcessing(false);
    }
  };

  // ── File View / Download ──────────────────────────────────────────────────

  const handleViewFile = async (filePath: string, fileName: string) => {
    setViewModalName(fileName);
    setViewModalUrl('');
    setViewModalOpen(true);
    setViewModalLoading(true);
    try {
      const url = await getSignedUrl(filePath);
      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      setViewModalUrl(
        ext === 'pdf'
          ? url
          : `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
      );
    } catch {
      toast.error('Failed to get file URL');
      setViewModalOpen(false);
    } finally {
      setViewModalLoading(false);
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
    try {
      const url = await getSignedUrl(filePath);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  // ── Discussion helpers ────────────────────────────────────────────────────

  const getToken = async () => {
    const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
    return session.data.session?.access_token ?? '';
  };

  const handleOpenDiscussion = async (sub: ChapterSubmission) => {
    setDiscussionTarget(sub);
    setDiscussionComments([]);
    setNewDiscussionComment('');
    setDiscussionLoading(true);
    try {
      const token = await getToken();
      const comments = await fetchComments(sub.id, token);
      setDiscussionComments(comments);
    } catch {
      toast.error('Failed to load discussion');
    } finally {
      setDiscussionLoading(false);
    }
  };

  const handlePostDiscussionComment = async () => {
    if (!discussionTarget || !newDiscussionComment.trim()) return;
    setDiscussionPosting(true);
    try {
      const token = await getToken();
      const comment = await postComment(discussionTarget.id, newDiscussionComment.trim(), token);
      setDiscussionComments((prev) => [...prev, comment]);
      setNewDiscussionComment('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setDiscussionPosting(false);
    }
  };

  // ── Mark as IP / Remove IP ────────────────────────────────────────────────

  const handleMarkAsIP = async () => {
    if (!ipTarget || !user) return;
    setIpProcessing(true);
    try {
      const session = await import('../../lib/supabase').then((m) =>
        m.supabase.auth.getSession()
      );
      const token = session.data.session?.access_token ?? '';
      const newStatus = ipTarget.projectStatus === 'ip' ? 'normal' : 'ip';
      await requestMarkAsIP(ipTarget.id, newStatus, ipReason.trim(), token);

      setGradesData((prev) =>
        prev.map((g) =>
          g.id === ipTarget.id
            ? {
                ...g,
                projectStatus: newStatus as 'ip' | 'normal',
                ipMarkedAt: newStatus === 'ip' ? new Date().toISOString() : null,
                ipReason:   newStatus === 'ip' ? ipReason.trim() || null : null,
              }
            : g
        )
      );

      toast.success(
        newStatus === 'ip'
          ? `Group ${ipTarget.groupNumber} marked as In Progress`
          : `IP status removed from Group ${ipTarget.groupNumber}`
      );
      setIpTarget(null);
      setIpReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update project status');
    } finally {
      setIpProcessing(false);
    }
  };

  if (!user) return null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Layout user={user} pageTitle="My Groups">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">

        {/* ── Top-level tab bar ── */}
        <div className="mb-4 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <TabsList className="w-full justify-start rounded-none bg-transparent p-0 h-auto border-b border-[var(--color-border)]">
            <TabsTrigger
              value="my-groups"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent px-6 py-3 gap-2"
            >
              <Users className="w-4 h-4" />
              My Groups
            </TabsTrigger>
            <TabsTrigger
              value="chapter-submission"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent px-6 py-3 gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Chapter Submission
              {stats.pending > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-white text-xs font-semibold">
                  {stats.pending}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="groups-grades"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--color-primary-600)] data-[state=active]:bg-transparent px-6 py-3 gap-2"
            >
              <BarChart2 className="w-4 h-4" />
              Groups Grades &amp; Evaluation
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ════════════════════════════════════════
            TAB 1 — MY GROUPS
            ════════════════════════════════════════ */}
        <TabsContent value="my-groups" className="mt-0">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-[var(--color-text-900)]">Assigned Groups</h2>
                <p className="text-[var(--color-text-600)] text-sm mt-0.5">
                  Groups supervised by you this semester
                </p>
              </div>
              {!groupsLoading && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-sm font-medium">
                  {groups.length} {groups.length === 1 ? 'Group' : 'Groups'}
                </span>
              )}
            </div>

            {/* Groups table */}
            {groupsLoading ? (
              <div className="flex items-center justify-center min-h-40 p-6">
                <div className="text-center">
                  <Clock className="w-8 h-8 text-[var(--color-text-400)] mx-auto mb-2 animate-spin" />
                  <p className="text-[var(--color-text-600)]">Loading groups…</p>
                </div>
              </div>
            ) : groups.length === 0 ? (
              <div className="flex items-center justify-center min-h-40 p-6">
                <div className="text-center">
                  <Users className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-3" />
                  <p className="text-[var(--color-text-600)] text-lg">No groups assigned</p>
                  <p className="text-[var(--color-text-500)] text-sm mt-1">
                    Groups assigned to you will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[var(--color-surface-alt)]">
                    <tr>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                        Group
                      </th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                        Group ID
                      </th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                        Project Title
                      </th>
                      <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                        Students
                      </th>
                      <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                        Course
                      </th>
                      <th className="p-4 text-center text-[var(--color-text-900)]">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]">
                    {groups.map((group) => (
                      <tr
                        key={group.id}
                        className="hover:bg-[var(--color-surface-alt)] transition-colors"
                      >
                        <td className="p-4 border-r border-[var(--color-border)]">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-sm font-semibold">
                            Group {group.groupNumber}
                          </span>
                        </td>
                        <td className="p-4 border-r border-[var(--color-border)]">
                          <span className="font-mono text-xs text-[var(--color-text-500)] select-all">
                            {group.groupCode}
                          </span>
                        </td>
                        <td className="p-4 border-r border-[var(--color-border)]">
                          <span className="text-[var(--color-text-900)]">
                            {group.projectTitle}
                          </span>
                        </td>
                        <td className="p-4 border-r border-[var(--color-border)]">
                          <div className="flex flex-wrap gap-1">
                            {group.students.map((s) => (
                              <span
                                key={s.id}
                                className="text-[var(--color-text-700)] text-sm bg-[var(--color-surface-alt)] px-2 py-0.5 rounded"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="p-4 text-center border-r border-[var(--color-border)]">
                          <span className="text-[var(--color-text-700)] text-sm">{group.course}</span>
                        </td>
                        <td className="p-4 text-center">
                          <StatusBadge status={group.status as any} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick action */}
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-900 text-sm">
                Switch to the <strong>Chapter Submission</strong> tab to review and approve chapter submissions
                from the groups listed here.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto flex-shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100"
              onClick={() => setActiveTab('chapter-submission')}
            >
              Go to Submissions
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════
            TAB 2 — CHAPTER SUBMISSION
            ════════════════════════════════════════ */}
        <TabsContent value="chapter-submission" className="mt-0">
          <p className="text-[var(--color-text-600)] mb-3">
            Review and approve chapter submissions from your supervised groups.
            Supervisors may approve or reject submissions — grading is handled separately by the Coordinator.
          </p>

          {/* Group filter */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 mb-4">
            <div className="max-w-md">
              <Label htmlFor="group-filter" className="mb-2 block text-[var(--color-text-900)]">
                Filter by Group
              </Label>
              <Select value={filterGroup} onValueChange={setFilterGroup}>
                <SelectTrigger id="group-filter">
                  <SelectValue placeholder="All groups" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All groups</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      Group {g.groupNumber} — {g.projectTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Two-column layout: submissions table + right sidebar */}
          <div className="flex gap-6 items-start">

            {/* ── Left: submissions table ── */}
            <div className="flex-1 max-w-[800px]">

              {/* Stats cards (same visual pattern as old grading summary cards) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <span className="text-yellow-900 text-sm">Pending Review</span>
                  </div>
                  <p className="text-2xl text-yellow-900">{stats.pending}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-green-900 text-sm">Approved</span>
                  </div>
                  <p className="text-2xl text-green-900">{stats.approved}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <XCircle className="w-4 h-4 text-amber-600" />
                    <span className="text-amber-900 text-sm">Changes Requested</span>
                  </div>
                  <p className="text-2xl text-amber-900">{stats.rejected}</p>
                </div>
              </div>

              {/* Submissions table */}
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                {submissionsLoading ? (
                  <div className="flex items-center justify-center min-h-40 p-6">
                    <div className="text-center">
                      <Clock className="w-8 h-8 text-[var(--color-text-400)] mx-auto mb-2 animate-spin" />
                      <p className="text-[var(--color-text-600)]">Loading submissions…</p>
                    </div>
                  </div>
                ) : filteredSubmissions.length === 0 ? (
                  <div className="flex items-center justify-center min-h-40 p-6">
                    <div className="text-center">
                      <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-3" />
                      <p className="text-[var(--color-text-600)] text-lg">No submissions found</p>
                      <p className="text-[var(--color-text-500)] text-sm mt-1">
                        Chapter submissions from your groups will appear here
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-[var(--color-surface-alt)]">
                        <tr>
                          <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Chapter Name
                          </th>
                          <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Group
                          </th>
                          <th className="p-4 text-left text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Group ID
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Submitted
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            Status
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                            File
                          </th>
                          <th className="p-4 text-center text-[var(--color-text-900)]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {filteredSubmissions.map((sub) => {
                          const isPending =
                            sub.status === 'submitted' || sub.status === 'under-review';
                          return (
                            <tr
                              key={sub.id}
                              className="hover:bg-[var(--color-surface-alt)] transition-colors"
                            >
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-900)]">
                                  {sub.milestoneName}
                                </span>
                                {sub.currentVersion > 1 && (
                                  <span className="ml-2 text-xs text-[var(--color-text-500)]">
                                    v{sub.currentVersion}
                                  </span>
                                )}
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <div className="text-[var(--color-text-900)] text-sm">
                                  Group {sub.groupNumber}
                                </div>
                                <div className="text-[var(--color-text-600)] text-xs truncate max-w-[140px]">
                                  {sub.projectName}
                                </div>
                              </td>
                              <td className="p-4 border-r border-[var(--color-border)]">
                                <span className="font-mono text-xs text-[var(--color-text-500)] select-all">
                                  {groups.find((g) => g.id === sub.groupId)?.groupCode ?? sub.groupId}
                                </span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span className="text-[var(--color-text-600)] text-sm">
                                  {formatDate(sub.submittedAt)}
                                </span>
                              </td>
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                <span
                                  className={`inline-flex items-center px-3 py-1 rounded-full border text-sm ${getStatusColor(sub.status)}`}
                                >
                                  {getStatusText(sub.status)}
                                </span>
                              </td>
                              {/* ── File column ── */}
                              <td className="p-4 text-center border-r border-[var(--color-border)]">
                                {(() => {
                                  const latestVersion = sub.versions[sub.versions.length - 1];
                                  const filePath = latestVersion?.file_path ?? null;
                                  const fileName = latestVersion?.file_name ?? 'file';
                                  if (!filePath) return <span className="text-[var(--color-text-400)] text-sm">—</span>;
                                  return (
                                    <div className="flex items-center justify-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={() => handleViewFile(filePath, fileName)}
                                      >
                                        <Eye className="w-3 h-3" />
                                        View
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1"
                                        onClick={() => handleDownloadFile(filePath, fileName)}
                                      >
                                        <Download className="w-3 h-3" />
                                        Download
                                      </Button>
                                    </div>
                                  );
                                })()}
                              </td>
                              {/* ── Actions column ── */}
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2 flex-wrap">
                                  {isPending && (
                                    <>
                                      <Button
                                        size="sm"
                                        className="gap-1 !bg-green-600 hover:!bg-green-700 text-white border-green-600"
                                        onClick={() => {
                                          setApproveTarget(sub);
                                          setApproveComment('');
                                        }}
                                      >
                                        <CheckCircle className="w-3 h-3" />
                                        Approve
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="gap-1 text-amber-600 border-amber-300 hover:bg-amber-50"
                                        onClick={() => {
                                          setRejectTarget(sub);
                                          setRejectFeedback('');
                                        }}
                                      >
                                        <XCircle className="w-3 h-3" />
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1 text-blue-600 border-blue-300 hover:bg-blue-50"
                                    onClick={() => handleOpenDiscussion(sub)}
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    Discussion
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right sidebar (sticky) ── */}
            <div className="w-[280px] flex-shrink-0">
              <div className="sticky top-6 space-y-4">

                {/* Submission summary card */}
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-md p-5">
                  <h3 className="text-[var(--color-text-900)] text-sm font-semibold mb-3">
                    Review Summary
                  </h3>

                  <div className="text-center mb-4 p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border border-blue-200">
                    <p className="text-[var(--color-text-600)] mb-1 text-sm">Total Submissions</p>
                    <p className="text-4xl text-[var(--color-text-900)]">
                      {filteredSubmissions.length}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-yellow-700">
                        <Clock className="w-3.5 h-3.5" />
                        Pending
                      </span>
                      <span className="font-semibold text-[var(--color-text-900)]">
                        {stats.pending}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-green-700">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approved
                      </span>
                      <span className="font-semibold text-[var(--color-text-900)]">
                        {stats.approved}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <XCircle className="w-3.5 h-3.5" />
                        Changes Req.
                      </span>
                      <span className="font-semibold text-[var(--color-text-900)]">
                        {stats.rejected}
                      </span>
                    </div>
                  </div>

                  {/* Completion bar */}
                  {filteredSubmissions.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-600)]">Review progress</span>
                        <span className="text-xs text-[var(--color-text-900)] font-semibold">
                          {Math.round(((stats.approved + stats.rejected) / filteredSubmissions.length) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--color-primary-600)] to-blue-500 transition-all duration-300"
                          style={{
                            width: `${((stats.approved + stats.rejected) / filteredSubmissions.length) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Approval-only reminder */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-blue-800 text-xs">
                      Supervisors review and approve chapter submissions only.
                      Grading is managed exclusively by the Coordinator.
                    </p>
                  </div>
                </div>

                {/* Quick links */}
                <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-4">
                  <h4 className="text-[var(--color-text-900)] mb-2 text-sm font-semibold">
                    Quick Links
                  </h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => navigate('/supervisor/weekly-reports')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] text-sm transition-colors flex items-center justify-between"
                    >
                      Weekly Reports
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-400)]" />
                    </button>
                    <button
                      onClick={() => navigate('/supervisor/grading')}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--color-surface-alt)] text-[var(--color-text-900)] text-sm transition-colors flex items-center justify-between"
                    >
                      Supervisor Assessment
                      <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-400)]" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════
            TAB 3 — GROUPS GRADES & EVALUATION
            ════════════════════════════════════════ */}
        <TabsContent value="groups-grades" className="mt-0">
          <p className="text-[var(--color-text-600)] mb-3 text-sm">
            View grades and evaluation records for your assigned groups.
            Grading weights are defined by the Coordinator and cannot be modified here.
          </p>

          {gradesLoading ? (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] flex items-center justify-center min-h-52 p-6">
              <div className="text-center">
                <Clock className="w-8 h-8 text-[var(--color-text-400)] mx-auto mb-2 animate-spin" />
                <p className="text-[var(--color-text-600)]">Loading grades…</p>
              </div>
            </div>
          ) : gradesData.length === 0 ? (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] flex items-center justify-center min-h-52 p-6">
              <div className="text-center">
                <BarChart2 className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-3" />
                <p className="text-[var(--color-text-600)] text-lg">No grade data available</p>
                <p className="text-[var(--color-text-500)] text-sm mt-1">
                  Grade information for your groups will appear here once available
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {gradesData.map((group) => {
                const isExpanded = expandedGroups.has(group.id);
                const isIP = group.projectStatus === 'ip';
                const totalComponentScore = group.components.reduce(
                  (sum, c) => sum + (c.score ?? 0), 0
                );
                const totalComponentMax = group.components.reduce(
                  (sum, c) => sum + c.totalMarks, 0
                );

                return (
                  <div
                    key={group.id}
                    className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                  >
                    {/* ── Group header (clickable to expand) ── */}
                    <div
                      className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
                      onClick={() =>
                        setExpandedGroups((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.id)) next.delete(group.id);
                          else next.add(group.id);
                          return next;
                        })
                      }
                    >
                      {/* Group badge */}
                      <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-sm font-semibold flex-shrink-0">
                        Group {group.groupNumber}
                      </span>

                      {/* Project name + group code + course */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--color-text-900)] font-medium truncate">
                          {group.projectName}
                        </p>
                        {group.groupCode && (
                          <p className="text-[var(--color-text-400)] text-xs font-mono">{group.groupCode}</p>
                        )}
                        <p className="text-[var(--color-text-500)] text-xs">{group.courseCode}</p>
                      </div>

                      {/* IP badge */}
                      {isIP && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-300 text-xs font-semibold flex-shrink-0">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          In Progress
                        </span>
                      )}

                      {/* Mark as IP / Remove IP button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className={
                          isIP
                            ? 'flex-shrink-0 border-gray-400 text-gray-700 hover:bg-gray-50'
                            : 'flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-50'
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          setIpTarget(group);
                          setIpReason('');
                        }}
                      >
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {isIP ? 'Remove IP' : 'Mark as IP'}
                      </Button>

                      {/* Score summary */}
                      {totalComponentMax > 0 && (
                        <div className="text-right flex-shrink-0">
                          <p className="text-[var(--color-text-900)] font-semibold text-sm">
                            {totalComponentScore.toFixed(1)} / {totalComponentMax}
                          </p>
                          <p className="text-[var(--color-text-500)] text-xs">Total Score</p>
                        </div>
                      )}

                      {/* Expand/collapse chevron */}
                      {isExpanded
                        ? <ChevronUp className="w-5 h-5 text-[var(--color-text-400)] flex-shrink-0" />
                        : <ChevronDown className="w-5 h-5 text-[var(--color-text-400)] flex-shrink-0" />
                      }
                    </div>

                    {/* ── Expanded detail panel ── */}
                    {isExpanded && (
                      <div className="border-t border-[var(--color-border)] p-6 space-y-6">

                        {/* Students */}
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--color-text-700)] mb-2 flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            Students
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {group.students.map((s) => (
                              <span
                                key={s.id}
                                className="text-sm text-[var(--color-text-700)] bg-[var(--color-surface-alt)] px-3 py-1 rounded-full border border-[var(--color-border)]"
                              >
                                {s.name}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Grade components table — read-only, from Coordinator's scheme */}
                        <div>
                          <h4 className="text-sm font-semibold text-[var(--color-text-700)] mb-2 flex items-center gap-1.5">
                            <BarChart2 className="w-4 h-4" />
                            Grade Components
                            <span className="ml-1 text-xs font-normal text-[var(--color-text-500)]">
                              (Coordinator-defined — read-only)
                            </span>
                          </h4>
                          <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-[var(--color-surface-alt)]">
                                <tr>
                                  <th className="px-4 py-2.5 text-left text-[var(--color-text-700)] font-medium border-r border-[var(--color-border)]">
                                    Component
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-[var(--color-text-700)] font-medium border-r border-[var(--color-border)]">
                                    Evaluator
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-[var(--color-text-700)] font-medium border-r border-[var(--color-border)]">
                                    Weight
                                  </th>
                                  <th className="px-4 py-2.5 text-center text-[var(--color-text-700)] font-medium">
                                    Score
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[var(--color-border)]">
                                {group.components.map((comp) => (
                                  <tr
                                    key={comp.componentKey}
                                    className="hover:bg-[var(--color-surface-alt)]"
                                  >
                                    <td className="px-4 py-3 text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                                      {comp.componentName}
                                    </td>
                                    <td className="px-4 py-3 text-center border-r border-[var(--color-border)]">
                                      <span className="capitalize text-[var(--color-text-600)] text-xs bg-[var(--color-surface-alt)] px-2 py-0.5 rounded border border-[var(--color-border)]">
                                        {comp.evaluatorRole}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-[var(--color-text-700)] font-medium border-r border-[var(--color-border)]">
                                      {comp.totalMarks}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {comp.score != null ? (
                                        <span className="font-semibold text-[var(--color-text-900)]">
                                          {comp.score.toFixed(1)}
                                        </span>
                                      ) : (
                                        <span className="text-[var(--color-text-400)] text-xs">—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}

                                {/* Total row */}
                                {group.components.length > 0 && (
                                  <tr className="bg-[var(--color-surface-alt)] border-t-2 border-[var(--color-border)]">
                                    <td
                                      className="px-4 py-2.5 font-semibold text-[var(--color-text-900)] border-r border-[var(--color-border)]"
                                      colSpan={2}
                                    >
                                      Total
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-semibold text-[var(--color-text-900)] border-r border-[var(--color-border)]">
                                      {totalComponentMax}
                                    </td>
                                    <td className="px-4 py-2.5 text-center font-semibold text-[var(--color-text-900)]">
                                      {totalComponentScore.toFixed(1)}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Bottom row: supervisor eval + chapter approval counts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                          {/* Supervisor Evaluation */}
                          <div className="rounded-lg border border-[var(--color-border)] p-4">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-sm font-semibold text-[var(--color-text-700)] flex items-center gap-1.5">
                                <Award className="w-4 h-4" />
                                Supervisor Evaluation
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1.5"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/supervisor/evaluate-group/${group.id}`);
                                }}
                              >
                                <ClipboardList className="w-3 h-3" />
                                {group.supervisorEvaluation.some((e) => e.score != null)
                                  ? 'Edit Evaluation'
                                  : 'Evaluate Group'}
                              </Button>
                            </div>
                            {group.supervisorEvaluation.length === 0 ? (
                              <p className="text-sm text-[var(--color-text-500)]">
                                No evaluation submitted yet. Click "Evaluate Group" to begin.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {group.supervisorEvaluation.map((entry) => {
                                  const student = group.students.find(
                                    (s) => s.id === entry.studentId
                                  );
                                  return (
                                    <div
                                      key={entry.studentId}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <span className="text-sm text-[var(--color-text-700)] truncate flex-1">
                                        {student?.name ?? entry.studentId}
                                      </span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {entry.score != null ? (
                                          <span className="font-semibold text-[var(--color-text-900)] text-sm">
                                            {entry.score.toFixed(1)} / {entry.maxScore}
                                          </span>
                                        ) : (
                                          <span className="text-[var(--color-text-400)] text-xs">
                                            Not graded
                                          </span>
                                        )}
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded-full ${
                                            entry.submissionStatus === 'submitted'
                                              ? 'bg-green-100 text-green-700'
                                              : 'bg-gray-100 text-gray-600'
                                          }`}
                                        >
                                          {entry.submissionStatus === 'submitted'
                                            ? 'Submitted'
                                            : 'Draft'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                                {group.supervisorTotalScore != null && (
                                  <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between">
                                    <span className="text-sm font-semibold text-[var(--color-text-900)]">
                                      Average
                                    </span>
                                    <span className="text-sm font-semibold text-[var(--color-text-900)]">
                                      {group.supervisorTotalScore.toFixed(1)} / {group.supervisorMaxScore}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Chapter submission approvals */}
                          <div className="rounded-lg border border-[var(--color-border)] p-4">
                            <h4 className="text-sm font-semibold text-[var(--color-text-700)] mb-3 flex items-center gap-1.5">
                              <BookOpen className="w-4 h-4" />
                              Chapter Submissions
                            </h4>
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-[var(--color-text-600)]">
                                  <FileText className="w-3.5 h-3.5" />
                                  Total
                                </span>
                                <span className="font-semibold text-[var(--color-text-900)]">
                                  {group.approvalCounts.total}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-green-700">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Approved
                                </span>
                                <span className="font-semibold text-green-900">
                                  {group.approvalCounts.approved}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-yellow-700">
                                  <Clock className="w-3.5 h-3.5" />
                                  Pending
                                </span>
                                <span className="font-semibold text-yellow-900">
                                  {group.approvalCounts.pending}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-1.5 text-amber-700">
                                  <XCircle className="w-3.5 h-3.5" />
                                  Changes Req.
                                </span>
                                <span className="font-semibold text-amber-900">
                                  {group.approvalCounts.rejected}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* IP info banner (shown only when group is IP) */}
                        {isIP && group.ipMarkedAt && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-orange-800 text-sm font-medium">
                                  Marked as In Progress on {formatDate(group.ipMarkedAt)}
                                </p>
                                {group.ipReason && (
                                  <p className="text-orange-700 text-sm mt-0.5">{group.ipReason}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Approve Dialog ── */}
      <Dialog open={!!approveTarget} onOpenChange={(open) => { if (!open) setApproveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Approve Submission
            </DialogTitle>
            <DialogDescription>
              Approve <strong>{approveTarget?.milestoneName}</strong> from Group {approveTarget?.groupNumber}.
              This records your review — grading remains separate.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="approve-comment" className="mb-2 block">
              Comment (Optional)
            </Label>
            <Textarea
              id="approve-comment"
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              placeholder="Add an optional comment for the student…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveTarget(null)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              className="bg-[#10B981] text-black hover:bg-[#0ea572] gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              {processing ? 'Approving…' : 'Confirm Approval'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Dialog ── */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-amber-600" />
              Request Changes
            </DialogTitle>
            <DialogDescription>
              Request changes for <strong>{rejectTarget?.milestoneName}</strong> from Group {rejectTarget?.groupNumber}.
              Provide clear feedback so the student knows what to revise.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="reject-feedback" className="mb-2 block">
              Feedback <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="reject-feedback"
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              placeholder="Explain what changes are needed and why…"
              className="min-h-[120px]"
              required
            />
            {rejectFeedback.trim() === '' && (
              <p className="text-red-500 text-xs mt-1">Feedback is required when requesting changes.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)} disabled={processing}>
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              disabled={processing || !rejectFeedback.trim()}
              variant="outline"
              className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              <XCircle className="w-4 h-4" />
              {processing ? 'Submitting…' : 'Request Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Mark as IP / Remove IP Dialog ── */}
      <Dialog
        open={!!ipTarget}
        onOpenChange={(open) => { if (!open) { setIpTarget(null); setIpReason(''); } }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle
                className={`w-5 h-5 ${
                  ipTarget?.projectStatus === 'ip' ? 'text-gray-600' : 'text-orange-600'
                }`}
              />
              {ipTarget?.projectStatus === 'ip' ? 'Remove IP Status' : 'Mark Group as In Progress'}
            </DialogTitle>
            <DialogDescription>
              {ipTarget?.projectStatus === 'ip'
                ? `Remove the In Progress status from Group ${ipTarget?.groupNumber} — "${ipTarget?.projectName}". The group will return to normal status and students may proceed with the standard graduation timeline.`
                : `You are about to mark Group ${ipTarget?.groupNumber} — "${ipTarget?.projectName}" as In Progress (IP).`
              }
            </DialogDescription>
          </DialogHeader>

          {/* Warning box — only shown when marking as IP */}
          {ipTarget?.projectStatus !== 'ip' && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 -mt-1">
              <p className="text-orange-800 text-sm font-semibold mb-2">
                ⚠ Consequences of Marking as IP:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-orange-800">
                <li>Students in this group will <strong>not advance</strong> to the final defense this term.</li>
                <li>The project will continue into the <strong>next term</strong>.</li>
                <li>This action is recorded in the audit log with your name and timestamp.</li>
                <li>Only you (or an admin) can reverse this decision.</li>
              </ul>
            </div>
          )}

          {/* Reason input — only when marking as IP */}
          {ipTarget?.projectStatus !== 'ip' && (
            <div>
              <Label htmlFor="ip-reason" className="mb-2 block">
                Reason{' '}
                <span className="text-[var(--color-text-500)] text-xs font-normal">(Optional)</span>
              </Label>
              <Textarea
                id="ip-reason"
                value={ipReason}
                onChange={(e) => setIpReason(e.target.value)}
                placeholder="Briefly describe why this group is being marked as In Progress…"
                className="min-h-[90px]"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIpTarget(null); setIpReason(''); }}
              disabled={ipProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkAsIP}
              disabled={ipProcessing}
              className={
                ipTarget?.projectStatus === 'ip'
                  ? 'bg-gray-700 text-black hover:bg-gray-800'
                  : 'bg-orange-600 text-black hover:bg-orange-700'
              }
            >
              {ipProcessing
                ? ipTarget?.projectStatus === 'ip' ? 'Removing…' : 'Marking…'
                : ipTarget?.projectStatus === 'ip' ? 'Remove IP Status' : 'Confirm — Mark as IP'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── File Viewer Modal — full screen ── */}
      <Dialog open={viewModalOpen} onOpenChange={(open) => { if (!open) { setViewModalOpen(false); setViewModalUrl(''); } }}>
        <DialogContent className="!inset-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !max-w-full !w-screen !h-screen !rounded-none flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-3 border-b border-gray-200 flex-shrink-0 flex flex-row items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="w-4 h-4 text-blue-600" />
              {viewModalName}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            {viewModalLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading file...
              </div>
            ) : viewModalUrl ? (
              <iframe
                src={viewModalUrl}
                className="w-full h-full border-0"
                title={viewModalName}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Discussion Dialog ── */}
      <Dialog
        open={!!discussionTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDiscussionTarget(null);
            setDiscussionComments([]);
            setNewDiscussionComment('');
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Discussion
            </DialogTitle>
            <DialogDescription>
              <strong>{discussionTarget?.milestoneName}</strong> — Group {discussionTarget?.groupNumber}
              {discussionTarget?.studentName ? ` · ${discussionTarget.studentName}` : ''}
            </DialogDescription>
          </DialogHeader>

          {/* Comment thread */}
          <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-[200px] max-h-[360px]">
            {discussionLoading ? (
              <div className="flex items-center justify-center h-full py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-400)]" />
              </div>
            ) : discussionComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                <MessageSquare className="w-10 h-10 text-[var(--color-text-300)] mb-2" />
                <p className="text-[var(--color-text-500)] text-sm">No comments yet.</p>
                <p className="text-[var(--color-text-400)] text-xs mt-1">
                  Start the conversation with the student below.
                </p>
              </div>
            ) : (
              discussionComments.map((c) => {
                const isSupervisor = c.authorRole === 'supervisor';
                return (
                  <div
                    key={c.id}
                    className={`flex gap-2 ${isSupervisor ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${
                        isSupervisor ? 'bg-[var(--color-primary-600)]' : 'bg-emerald-500'
                      }`}
                    >
                      {c.authorName.charAt(0).toUpperCase()}
                    </div>
                    {/* Bubble */}
                    <div className={`max-w-[80%] ${isSupervisor ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      <span className="text-[10px] text-[var(--color-text-500)] px-1">
                        {c.authorName} · {c.authorRole === 'supervisor' ? 'Supervisor' : 'Student'}
                      </span>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm ${
                          isSupervisor
                            ? 'bg-[var(--color-primary-600)] text-white rounded-tr-sm'
                            : 'bg-[var(--color-surface-alt)] text-[var(--color-text-900)] border border-[var(--color-border)] rounded-tl-sm'
                        }`}
                      >
                        {c.content}
                      </div>
                      <span className="text-[10px] text-[var(--color-text-400)] px-1">
                        {new Date(c.createdAt).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Compose area */}
          <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
            <Textarea
              value={newDiscussionComment}
              onChange={(e) => setNewDiscussionComment(e.target.value)}
              placeholder="Type your message…"
              className="min-h-[80px] resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handlePostDiscussionComment();
                }
              }}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-[var(--color-text-400)]">Ctrl+Enter to send</span>
              <Button
                size="sm"
                onClick={handlePostDiscussionComment}
                disabled={discussionPosting || !newDiscussionComment.trim()}
                className="gap-1.5"
              >
                {discussionPosting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Send className="w-3.5 h-3.5" />
                }
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
