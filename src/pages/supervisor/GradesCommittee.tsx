import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { DocumentViewerWithAnnotations } from '../../components/DocumentViewerWithAnnotations';
import { getGroupsForEvaluation } from '../../services/groups';
import { getRubricCriteria } from '../../services/grading-rubric';
import {
  getPreviousCommitteeFeedback,
  getRoleBadge,
  getCommitteeEvalSubmissions,
  type GroupFile,
  type PreviousCommitteeFeedback,
  type CommitteeEvalSubmission,
} from '../../services/groupFiles';
import { getSignedUrl, uploadCommitteeFeedbackFile } from '../../services/storage';
import { apiUrl, apiFetch } from '@/lib/api';
import {
  Search,
  FileText,
  Save,
  Send,
  XCircle,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  ChevronDown,
  Download,
  Eye,
  Paperclip,
  History,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';

interface AssignedGroup {
  id: string;
  groupCode: string | null;
  projectName: string;
  groupId: string;
  course: 'CPIS-498' | 'CPIS-499';
  milestone: 'Presentation' | 'Poster';
  date?: string;
  room?: string;
  status: 'not-scheduled' | 'scheduled' | 'completed';
  /** Server-computed: evaluation is unlocked when presentation time has passed. */
  evaluationActive: boolean;
  students: { id: string; name: string }[];
}

interface CommitteeCriterion {
  id: string;
  name: string;
  maxScore: 5;
  score: number | null;
  description1?: string;
  description2?: string;
  description3?: string;
  description4?: string;
  description5?: string;
}

/** Maps a Likert score (1–5) or null to a colour. */
const getScoreColor = (score: number | null): string => {
  if (score === null) return '#d1d5db';
  const colors: Record<number, string> = {
    1: '#ef4444',
    2: '#f97316',
    3: '#eab308',
    4: '#86efac',
    5: '#16a34a',
  };
  return colors[score] ?? '#d1d5db';
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** RoleBadge component — shows coloured pill for uploader role. */
function RoleBadge({ role }: { role: string }) {
  const badge = getRoleBadge(role);
  return (
    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${badge.className}`}>
      {badge.label}
    </span>
  );
}

/** A single file row with Download and View buttons. */
function FileRow({
  file,
  isPreviousCommittee = false,
  onView,
}: {
  file: GroupFile;
  isPreviousCommittee?: boolean;
  onView?: (fileUrl: string, filePath: string, fileName: string) => void;
}) {
  const handleDownload = async () => {
    try {
      const url = await getSignedUrl(file.filePath);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleView = async () => {
    try {
      const url = await getSignedUrl(file.filePath);
      onView ? onView(url, file.filePath, file.fileName) : window.open(url, '_blank');
    } catch {
      toast.error('Failed to open file');
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 p-4 border border-[var(--color-border)] rounded-lg bg-white hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <FileText className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-[var(--color-text-900)] truncate">
              {file.fileName}
            </span>
            {file.versionNumber > 1 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 border border-gray-200">
                v{file.versionNumber}
              </span>
            )}
            <RoleBadge role={isPreviousCommittee ? 'committee' : file.uploaderRole} />
            {isPreviousCommittee && (
              <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
                Previous Committee
              </span>
            )}
            {file.courseNumber && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {file.courseNumber}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-text-600)]">
            Uploaded by {file.uploaderName}
            {file.fileSize ? ` · ${formatFileSize(file.fileSize)}` : ''}
            {' · '}{formatDate(file.uploadedAt)}
          </p>
          {file.notes && (
            <p className="text-sm text-[var(--color-text-500)] italic mt-1">{file.notes}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <Button variant="outline" size="sm" onClick={handleView}>
          <Eye className="w-3.5 h-3.5 mr-1.5" />
          View
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Download
        </Button>
      </div>
    </div>
  );
}

/** A single row for a committee-eval milestone submission. */
function MilestoneSubmissionRow({
  entry,
  onView,
}: {
  entry: CommitteeEvalSubmission;
  onView?: (fileUrl: string, filePath: string, fileName: string) => void;
}) {
  const handleDownload = async () => {
    if (!entry.latestVersion?.filePath) return;
    try {
      const url = await getSignedUrl(entry.latestVersion.filePath);
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = entry.latestVersion.fileName;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error('Failed to download file');
    }
  };

  const handleView = async () => {
    if (!entry.latestVersion?.filePath) return;
    try {
      const url = await getSignedUrl(entry.latestVersion.filePath);
      onView ? onView(url, entry.latestVersion.filePath, entry.latestVersion.fileName) : window.open(url, '_blank');
    } catch {
      toast.error('Failed to open file');
    }
  };

  const statusColors: Record<string, string> = {
    'approved': 'bg-green-100 text-green-700 border-green-200',
    'submitted': 'bg-blue-100 text-blue-700 border-blue-200',
    'under-review': 'bg-yellow-100 text-yellow-700 border-yellow-200',
    'changes-requested': 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="p-4 border border-[var(--color-border)] rounded-lg bg-white hover:bg-gray-50 transition-colors">
      {/* Top row: icon + filename + version + status */}
      <div className="flex items-start gap-3">
        <FileText className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-[var(--color-text-900)] truncate">
            {entry.latestVersion?.fileName ?? entry.milestoneName}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {entry.latestVersion && entry.latestVersion.version > 1 && (
              <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-600 border border-gray-200">
                v{entry.latestVersion.version}
              </span>
            )}
            <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
              {entry.milestoneName}
            </span>
            {entry.status && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-medium border ${statusColors[entry.status] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                {entry.status.replace(/-/g, ' ')}
              </span>
            )}
          </div>
          {entry.latestVersion ? (
            <>
              <p className="text-xs text-[var(--color-text-500)] mt-2">
                {entry.submitterName ?? 'Student'}
                {entry.latestVersion.fileSize ? ` · ${formatFileSize(entry.latestVersion.fileSize)}` : ''}
                {entry.submittedAt ? ` · ${formatDate(entry.submittedAt)}` : ''}
              </p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={handleView}>
                  <Eye className="w-3.5 h-3.5 mr-1" />
                  View
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Download
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--color-text-400)] italic mt-1">No submission yet</p>
          )}
          {entry.latestVersion?.notes && (
            <p className="text-xs text-[var(--color-text-500)] italic mt-1">{entry.latestVersion.notes}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SupervisorGradesCommittee() {
  const { user } = useAuth();

  const [isGrading, setIsGrading] = useState(false);
  const [selectedGroupForGrading, setSelectedGroupForGrading] = useState<AssignedGroup | null>(null);
  const [assignedGroups, setAssignedGroups] = useState<AssignedGroup[]>([]);
  const [assignmentMode, setAssignmentMode] = useState(false);

  // Inline file viewer state
  const [viewerState, setViewerState] = useState<{
    fileUrl: string;
    filePath: string;
    fileName: string;
  } | null>(null);

  const openViewer = (fileUrl: string, filePath: string, fileName: string) =>
    setViewerState({ fileUrl, filePath, fileName });

  useEffect(() => {
    if (!user) return;
    getGroupsForEvaluation().then(({ groups, assignmentMode: mode }) => {
      setAssignmentMode(mode);
      setAssignedGroups(groups.map((g) => ({
        id: g.id,
        groupCode: g.groupCode ?? null,
        projectName: g.projectName,
        groupId: g.groupNumber != null ? String(g.groupNumber) : g.id,
        course: (g.courseNumber ?? '').includes('499') || g.courseCode.includes('499') ? 'CPIS-499' : 'CPIS-498',
        milestone: 'Presentation' as const,
        status: 'not-scheduled' as const,
        evaluationActive: g.evaluationActive,
        students: g.students ?? [],
      })));
    });
  }, [user?.id]);

  // Groups to Evaluate
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>(['498', '499']);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['not-scheduled', 'scheduled', 'completed']);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Grading States
  const [gradingStatus, setGradingStatus] = useState<'draft' | 'submitted'>('draft');
  const [isIP, setIsIP] = useState(false);
  const [ipReason, setIpReason] = useState('');
  const [showIPModal, setShowIPModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Accordion open state — only one criterion open at a time
  const [openCriterionId, setOpenCriterionId] = useState<string | null>(null);

  // Committee criteria — loaded from Grade Scheme Editor (Examination Committee)
  const [committeeCriteria, setCommitteeCriteria] = useState<CommitteeCriterion[]>([]);

  // Milestone submissions flagged for committee evaluation
  const [committeeEvalSubmissions, setCommitteeEvalSubmissions] = useState<CommitteeEvalSubmission[]>([]);
  const [loadingEvalSubmissions, setLoadingEvalSubmissions] = useState(false);

  // Previous committee feedback (CPIS-498 → CPIS-499)
  const [prevFeedback, setPrevFeedback] = useState<PreviousCommitteeFeedback | null>(null);
  const [loadingPrevFeedback, setLoadingPrevFeedback] = useState(false);
  const [showPrevFeedback, setShowPrevFeedback] = useState(false);

  useEffect(() => {
    if (!selectedGroupForGrading || !user) return;
    const courseType = selectedGroupForGrading.course === 'CPIS-499' ? '499' : '498';

    Promise.all([
      getRubricCriteria(courseType, 'committee_eval'),
      supabase
        .from('committee_rubric_scores')
        .select('criterion_key, score')
        .eq('group_id', selectedGroupForGrading.id)
        .eq('evaluator_id', user.id),
      supabase
        .from('committee_evaluations')
        .select('submission_status, comment')
        .eq('group_id', selectedGroupForGrading.id)
        .eq('evaluator_id', user.id)
        .maybeSingle(),
    ]).then(([criteria, scoresResult, evalResult]) => {
      const scoreMap: Record<string, number> = {};
      for (const row of (scoresResult.data ?? [])) {
        scoreMap[row.criterion_key] = row.score;
      }
      setCommitteeCriteria(criteria.map((c) => ({
        id: c.criterionKey,
        name: c.criterionName,
        maxScore: c.maxRawScore as 5,
        score: scoreMap[c.criterionKey] ?? null,
        description1: c.description1,
        description2: c.description2,
        description3: c.description3,
        description4: c.description4,
        description5: c.description5,
      })));
      if (evalResult.data) {
        setGradingStatus(evalResult.data.submission_status as 'draft' | 'submitted');
        setCommitteeComments(evalResult.data.comment ?? '');
      }
    });

    // Load milestone submissions flagged for committee eval
    setLoadingEvalSubmissions(true);
    getCommitteeEvalSubmissions(selectedGroupForGrading.id, 'supervisor')
      .then(setCommitteeEvalSubmissions)
      .finally(() => setLoadingEvalSubmissions(false));

    // Load previous committee feedback for CPIS-499 groups
    if (selectedGroupForGrading.course === 'CPIS-499') {
      setLoadingPrevFeedback(true);
      getPreviousCommitteeFeedback(selectedGroupForGrading.id, 'supervisor')
        .then(setPrevFeedback)
        .finally(() => setLoadingPrevFeedback(false));
    } else {
      setPrevFeedback(null);
    }
  }, [selectedGroupForGrading?.id]);

  const [committeeComments, setCommitteeComments] = useState('');

  // Feedback file state
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const [isUploading, setIsUploading]   = useState(false);

  // Filter groups
  const filteredGroups = assignedGroups.filter(group => {
    const matchesSearch = group.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         group.groupId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCourse = selectedCourses.includes(group.course === 'CPIS-498' ? '498' : '499');
    const matchesStatus = selectedStatuses.includes(group.status);
    return matchesSearch && matchesCourse && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredGroups.length / itemsPerPage);
  const paginatedGroups = filteredGroups.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle course chip toggle
  const toggleCourse = (course: string) => {
    setSelectedCourses(prev =>
      prev.includes(course) ? prev.filter(c => c !== course) : [...prev, course]
    );
  };

  // Handle status chip toggle
  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  // Handle evaluate - open grading view
  const handleEvaluate = (groupId: string) => {
    const group = assignedGroups.find(g => g.groupId === groupId);
    if (group) {
      setSelectedGroupForGrading(group);
      setIsGrading(true);
    }
  };

  // Handle back from grading
  const handleBackFromGrading = () => {
    setIsGrading(false);
    setSelectedGroupForGrading(null);
    setOpenCriterionId(null);
    setPrevFeedback(null);
    setShowPrevFeedback(false);
    setFeedbackFile(null);
    setCommitteeComments('');
    setGradingStatus('draft');
    setIsIP(false);
    setIpReason('');
  };

  // Calculate committee total
  const calculateCommitteeTotal = () => {
    return committeeCriteria.reduce((sum, criterion) => sum + (criterion.score || 0), 0);
  };

  // Check unfilled
  const hasUnfilledCommittee = () => {
    return committeeCriteria.some(c => c.score === null);
  };

  // Handle committee score change
  const handleCommitteeScoreChange = (id: string, score: number) => {
    const newCriteria = committeeCriteria.map(c =>
      c.id === id ? { ...c, score } : c
    );
    setCommitteeCriteria(newCriteria);
  };

  /** Calls the committee-evaluation API (draft or submitted). */
  const callCommitteeEvaluationApi = async (
    submissionStatus: 'draft' | 'submitted',
    commentFilePath?: string,
    commentFileName?: string
  ) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token ?? '';

    const body = {
      groupId:          selectedGroupForGrading!.id,
      scores:           committeeCriteria.map((c) => ({ criterionKey: c.id, score: c.score ?? 0 })),
      comment:          committeeComments || null,
      commentFilePath:  commentFilePath  ?? null,
      commentFileName:  commentFileName  ?? null,
      submissionStatus,
    };

    const res = await apiFetch(apiUrl('/api/evaluations/committee-evaluation'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Failed to save evaluation');
    }
  };

  // Handle save draft
  const handleSaveDraft = async () => {
    if (!selectedGroupForGrading) return;
    setIsUploading(true);
    try {
      let filePath: string | undefined;
      let fileName: string | undefined;

      if (feedbackFile) {
        filePath = await uploadCommitteeFeedbackFile(feedbackFile, selectedGroupForGrading.id, user!.id);
        fileName = feedbackFile.name;
      }

      await callCommitteeEvaluationApi('draft', filePath, fileName);
      toast.success('Draft saved successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle submit grades
  const handleSubmitGrades = () => {
    if (hasUnfilledCommittee()) {
      toast.error('Please score all criteria before submitting');
      return;
    }
    setShowSubmitModal(true);
  };

  const confirmSubmitGrades = async () => {
    if (!selectedGroupForGrading) return;
    setIsUploading(true);
    setShowSubmitModal(false);
    try {
      let filePath: string | undefined;
      let fileName: string | undefined;

      if (feedbackFile) {
        filePath = await uploadCommitteeFeedbackFile(feedbackFile, selectedGroupForGrading.id, user!.id);
        fileName = feedbackFile.name;
      }

      await callCommitteeEvaluationApi('submitted', filePath, fileName);
      setGradingStatus('submitted');
      toast.success('Grades submitted successfully');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to submit grades');
    } finally {
      setIsUploading(false);
    }
  };

  // Handle Mark IP
  const handleMarkIP = () => {
    setShowIPModal(true);
  };

  const confirmMarkIP = () => {
    if (!ipReason.trim()) {
      toast.error('Please provide a reason for marking as IP');
      return;
    }
    setIsIP(true);
    setShowIPModal(false);
    toast.success('Marked as IP (Not Ready)');
  };

  if (!user) return null;

  if (viewerState) {
    return (
      <DocumentViewerWithAnnotations
        fileUrl={viewerState.fileUrl}
        filePath={viewerState.filePath}
        fileName={viewerState.fileName}
        onClose={() => setViewerState(null)}
        userId={user.id}
        userName={user.name}
        userRole={user.activeRole}
      />
    );
  }

  // ─── Grading / Evaluation View ────────────────────────────────────────────
  if (isGrading && selectedGroupForGrading) {
    const isReadOnly = isIP;
    const total = calculateCommitteeTotal();
    const percentage = committeeCriteria.length > 0
      ? Math.round((total / 40) * 100)
      : 0;

    const hasPrevFeedback =
      prevFeedback !== null &&
      prevFeedback.previousGroup !== null &&
      (prevFeedback.scores.length > 0 || prevFeedback.comments.length > 0 || prevFeedback.files.length > 0);

    return (
      <Layout user={user} pageTitle="Evaluate & Grade">
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={handleBackFromGrading}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Groups
          </Button>

          {/* Header */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <h1 className="text-[var(--color-text-900)]">
                    {selectedGroupForGrading.projectName}
                  </h1>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    selectedGroupForGrading.course === 'CPIS-498'
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-purple-100 text-purple-700 border border-purple-200'
                  }`}>
                    {selectedGroupForGrading.course === 'CPIS-498' ? '498' : '499'}
                  </span>
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    gradingStatus === 'submitted'
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                  }`}>
                    {gradingStatus === 'submitted' ? 'Submitted' : 'Draft'}
                  </span>
                  {isIP && (
                    <span className="px-3 py-1 text-sm rounded-full bg-red-100 text-red-700 border border-red-200">
                      IP - Not Ready
                    </span>
                  )}
                </div>
                {selectedGroupForGrading.students.length > 0 && (
                  <p className="text-sm text-[var(--color-text-500)] mt-0.5">
                    {selectedGroupForGrading.students.map((s) => s.name).join(' · ')}
                  </p>
                )}
                <p className="text-sm text-[var(--color-text-600)]">{selectedGroupForGrading.groupCode ?? selectedGroupForGrading.id}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" onClick={handleSaveDraft} disabled={isUploading || isReadOnly || gradingStatus === 'submitted'}>
                  <Save className="w-4 h-4 mr-2" />
                  {isUploading ? 'Saving…' : 'Save Draft'}
                </Button>
                <Button
                  onClick={handleSubmitGrades}
                  className="bg-green-600 hover:bg-green-700 text-[rgb(0,0,0)]"
                  disabled={isIP || isUploading}
                >
                  <Send className="w-4 h-4 mr-2" />
                  {gradingStatus === 'submitted' ? 'Re-submit Grades' : 'Submit Grades'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleMarkIP}
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  disabled={isIP}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Mark IP
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Evaluation Area — accordion left, summary right */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">

          {/* ── Left: Accordion criteria list + files + prev feedback (70%) ── */}
          <div className="w-full lg:flex-[7] min-w-0 space-y-6">

            {/* ── Committee Evaluation Matrix ── */}
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 lg:p-8">
              <div className="mb-6">
                <h3 className="text-[var(--color-text-900)] mb-2">Committee Evaluation Matrix</h3>
                <p className="text-[var(--color-text-600)]">
                  Evaluate 8 criteria using Likert scale (1–5). Each criterion is worth 5 marks. Total: 40 marks.
                </p>
              </div>

              {/* Progress bar */}
              {committeeCriteria.length > 0 && (
                <div className="mb-6">
                  <div className="flex justify-between text-xs text-[var(--color-text-600)] mb-1">
                    <span>{committeeCriteria.filter(c => c.score !== null).length} of {committeeCriteria.length} criteria graded</span>
                    <span>{total} / 40</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${(total / 40) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Accordion items */}
              <div className="space-y-3">
                {committeeCriteria.map((criterion) => {
                  const isOpen = openCriterionId === criterion.id;

                  return (
                    <div
                      key={criterion.id}
                      className="border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* ── Collapsed Header ── */}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 bg-[var(--color-surface-white)] hover:bg-gray-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                        onClick={() =>
                          setOpenCriterionId(isOpen ? null : criterion.id)
                        }
                        aria-expanded={isOpen}
                      >
                        <span className="font-medium text-[var(--color-text-900)] pr-4">
                          {criterion.name}
                        </span>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {criterion.score !== null ? (
                            <span className="text-sm text-[var(--color-text-600)]">
                              Score:&nbsp;
                              <strong className="text-[var(--color-text-900)]">
                                {criterion.score} / 5
                              </strong>
                            </span>
                          ) : (
                            <span className="text-sm italic text-[var(--color-text-400)]">
                              Not Graded
                            </span>
                          )}

                          {/* Colour dot */}
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                            style={{ backgroundColor: getScoreColor(criterion.score) }}
                            aria-hidden="true"
                          />

                          {/* Chevron */}
                          <ChevronDown
                            className={`w-5 h-5 text-[var(--color-text-400)] transition-transform duration-300 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* ── Expanded Content ── */}
                      {isOpen && (
                        <div className="border-t border-[var(--color-border)] bg-gray-50 px-5 py-5">
                          <div className="space-y-3">
                            {[1, 2, 3, 4, 5].map((score) => {
                              const desc = criterion[`description${score}` as keyof CommitteeCriterion] as string | undefined;
                              const isSelected = criterion.score === score;

                              return (
                                <label
                                  key={score}
                                  className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                                    isReadOnly
                                      ? 'cursor-not-allowed'
                                      : 'cursor-pointer'
                                  } ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 bg-white hover:border-gray-300'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name={`criterion-${criterion.id}`}
                                    checked={isSelected}
                                    onChange={() =>
                                      !isReadOnly &&
                                      handleCommitteeScoreChange(criterion.id, score)
                                    }
                                    disabled={isReadOnly}
                                    className="mt-1 w-4 h-4 flex-shrink-0 accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className="text-sm font-bold"
                                        style={{ color: getScoreColor(score) }}
                                      >
                                        {score}
                                      </span>
                                      {isSelected && (
                                        <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
                                      )}
                                    </div>
                                    {desc && (
                                      <p className="text-sm text-[var(--color-text-700)] leading-relaxed">
                                        {desc}
                                      </p>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unfilled warning */}
              {hasUnfilledCommittee() && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-sm text-amber-900">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Some criteria are not scored yet</span>
                </div>
              )}

              {/* Committee Comments + File Upload */}
              <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-purple-100 text-purple-700 border border-purple-200">
                    Committee Feedback
                  </span>
                  <Label htmlFor="committee-comments" className="text-[var(--color-text-900)]">
                    Comments for Committee Evaluation
                  </Label>
                </div>
                <Textarea
                  id="committee-comments"
                  value={committeeComments}
                  onChange={(e) => setCommitteeComments(e.target.value)}
                  placeholder="Overall notes / justification for the scores..."
                  className="min-h-[150px]"
                  disabled={isReadOnly}
                />
                <p className="text-xs text-[var(--color-text-400)] mt-1">
                  Visible to: Committee members, Coordinator, Supervisor, and Students of this group.
                </p>

                {/* Feedback File Upload */}
                <div className="mt-4">
                  <Label className="text-[var(--color-text-900)] mb-2 block">
                    Upload Evaluation Comments File
                    <span className="ml-2 text-xs font-normal text-[var(--color-text-400)]">(PDF / DOCX / ZIP / PPTX — max 20 MB)</span>
                  </Label>

                  {feedbackFile ? (
                    <div className="flex items-center gap-3 p-3 border border-purple-200 bg-purple-50 rounded-lg">
                      <FileText className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-purple-900 truncate">{feedbackFile.name}</p>
                        <p className="text-xs text-purple-600">{formatFileSize(feedbackFile.size)}</p>
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => setFeedbackFile(null)}
                          className="text-purple-500 hover:text-purple-700 flex-shrink-0"
                          title="Remove file"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    !isReadOnly && (
                      <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-[var(--color-border)] rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                        <Upload className="w-6 h-6 text-[var(--color-text-400)]" />
                        <span className="text-sm text-[var(--color-text-600)]">
                          Click to choose a file or drag &amp; drop
                        </span>
                        <span className="text-xs text-[var(--color-text-400)]">
                          Example: annotated report, feedback sheet
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.zip,.pptx"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            if (!file) return;
                            if (file.size > 20 * 1024 * 1024) {
                              toast.error('File exceeds 20 MB limit');
                              return;
                            }
                            setFeedbackFile(file);
                          }}
                        />
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* ── Right: Live Summary Panel (30%) ── */}
          <div className="w-full lg:flex-[3] lg:sticky lg:top-6 self-start">
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
              <h4 className="font-semibold text-[var(--color-text-900)] mb-4">
                Committee Evaluation Summary
              </h4>

              <div className="space-y-0">
                {committeeCriteria.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-[var(--color-text-600)] pr-2 leading-snug">
                      {c.name}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {c.score !== null ? (
                        <>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getScoreColor(c.score) }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold text-[var(--color-text-900)] tabular-nums">
                            {c.score}&nbsp;/&nbsp;5
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--color-text-400)]">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-3 border-t-2 border-gray-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[var(--color-text-900)]">Total</span>
                  <span className="font-bold text-lg text-[var(--color-text-900)] tabular-nums">
                    {total}&nbsp;/&nbsp;40
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[var(--color-text-600)]">Percentage</span>
                  <span className="text-sm font-semibold text-[var(--color-text-900)] tabular-nums">
                    {percentage}%
                  </span>
                </div>

                {/* Mini progress bar */}
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: percentage >= 80
                        ? '#16a34a'
                        : percentage >= 60
                        ? '#eab308'
                        : '#ef4444',
                    }}
                  />
                </div>
              </div>

            </div>

            {/* ── Milestone Submissions for Committee Evaluation ── */}
            {(loadingEvalSubmissions || committeeEvalSubmissions.length > 0) && (
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5 mt-4">
                <div className="flex items-center gap-3 mb-4">
                  <Paperclip className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-[var(--color-text-900)]">Milestone Submissions</h3>
                  <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-indigo-100 text-indigo-700 border border-indigo-200">
                    Committee Eval
                  </span>
                </div>
                <p className="text-sm text-[var(--color-text-600)] mb-4">
                  Student submissions for milestones included in committee evaluation.
                </p>
                {loadingEvalSubmissions ? (
                  <div className="text-sm text-[var(--color-text-400)] py-4 text-center">
                    Loading milestone submissions…
                  </div>
                ) : (
                  <div className="space-y-3">
                    {committeeEvalSubmissions.map((entry) => (
                      <MilestoneSubmissionRow key={entry.milestoneId} entry={entry} onView={openViewer} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Previous Committee Feedback (CPIS-498 → CPIS-499) ── */}
            {selectedGroupForGrading.course === 'CPIS-499' && (
              <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5 mt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <History className="w-5 h-5 text-amber-600" />
                    <h3 className="text-[var(--color-text-900)]">Previous Committee Feedback</h3>
                    <span className="px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      CPIS-498
                    </span>
                  </div>
                  {hasPrevFeedback && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPrevFeedback(!showPrevFeedback)}
                    >
                      <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showPrevFeedback ? 'rotate-180' : ''}`} />
                      {showPrevFeedback ? 'Hide' : 'Show'}
                    </Button>
                  )}
                </div>

                {loadingPrevFeedback ? (
                  <div className="text-sm text-[var(--color-text-400)] py-4 text-center">Loading previous feedback…</div>
                ) : !hasPrevFeedback ? (
                  <div className="text-sm text-[var(--color-text-400)] py-6 text-center border border-dashed border-[var(--color-border)] rounded-lg">
                    No previous committee feedback found from CPIS-498.
                  </div>
                ) : showPrevFeedback && prevFeedback ? (
                  <div className="space-y-5">
                    <p className="text-xs text-[var(--color-text-400)]">
                      Read-only view of previous committee evaluation from CPIS-498.
                      You can add new comments and upload revised files above.
                    </p>

                    {prevFeedback.scores.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-2">
                          Previous Committee Scores
                        </h4>
                        <div className="space-y-1">
                          {prevFeedback.scores.map((s) => (
                            <div
                              key={`${s.evaluatorId}-${s.criterionKey}`}
                              className="flex justify-between items-center py-1.5 px-3 bg-gray-50 rounded-lg text-sm"
                            >
                              <span className="text-[var(--color-text-700)]">{s.criterionKey}</span>
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getScoreColor(s.score) }}
                                />
                                <span className="font-medium text-[var(--color-text-900)] tabular-nums">
                                  {s.score} / 5
                                </span>
                                <span className="text-xs text-[var(--color-text-400)]">
                                  by {s.evaluatorName}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {prevFeedback.comments.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-2">
                          Previous Committee Comments
                        </h4>
                        <div className="space-y-2">
                          {prevFeedback.comments.map((c) => (
                            <div
                              key={c.id}
                              className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-amber-900">{c.evaluatorName}</span>
                                <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700 border border-amber-200">
                                  Previous Committee
                                </span>
                                <span className="text-xs text-amber-600">{formatDate(c.createdAt)}</span>
                              </div>
                              <p className="text-amber-800">{c.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {prevFeedback.files.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-900)] mb-2">
                          Files from Previous Committee (CPIS-498)
                        </h4>
                        <div className="space-y-2">
                          {prevFeedback.files.map((f) => (
                            <FileRow key={f.id} file={f} isPreviousCommittee onView={openViewer} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Mark IP Modal */}
        <Dialog open={showIPModal} onOpenChange={setShowIPModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Mark as IP (Not Ready)</DialogTitle>
              <DialogDescription>
                This will mark the project as In Progress and not ready for final defense
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-900">
                  <p className="mb-2"><strong>Warning:</strong> This action will:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Lock all grading inputs</li>
                    <li>Prevent submission of grades</li>
                    <li>Notify the students and admin</li>
                    <li>Require admin approval to reverse</li>
                  </ul>
                </div>
              </div>

              <Label htmlFor="ip-reason" className="mb-2 block">Reason (Required)</Label>
              <Textarea
                id="ip-reason"
                value={ipReason}
                onChange={(e) => setIpReason(e.target.value)}
                placeholder="Explain why this project is not ready for final defense..."
                className="min-h-[120px]"
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowIPModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmMarkIP} className="bg-red-600 hover:bg-red-700 text-[rgb(0,0,0)]">
                Confirm Mark IP
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Submit Confirmation Modal */}
        <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Submit Grades</DialogTitle>
              <DialogDescription>
                Are you sure you want to submit these grades?
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-blue-900"><strong>Committee Total:</strong></span>
                  <span className="text-blue-900"><strong>{calculateCommitteeTotal()} / 40</strong></span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900">
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Once submitted, grades will be visible to admin and locked from further editing.
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmSubmitGrades} className="bg-green-600 hover:bg-green-700 text-[rgb(0,0,0)]">
                <Send className="w-4 h-4 mr-2" />
                Submit Grades
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Committee Evaluation">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Manage your committee assignments
        </p>
      </div>

      {assignmentMode && assignedGroups.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-amber-900">
            No groups assigned for evaluation — You will appear here once the coordinator publishes a presentation schedule that lists you as a committee member.
          </p>
        </div>
      ) : (
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            {/* Filter Bar */}
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex flex-col gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-400)]" />
                  <input
                    type="text"
                    placeholder="Search groups or projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Filter Chips */}
                <div className="flex flex-wrap gap-4 items-center">
                  {/* Course Filters */}
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-[var(--color-text-600)]">Course:</span>
                    <button
                      onClick={() => toggleCourse('498')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedCourses.includes('498')
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      CPIS-498
                    </button>
                    <button
                      onClick={() => toggleCourse('499')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedCourses.includes('499')
                          ? 'bg-purple-100 text-purple-700 border-purple-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      CPIS-499
                    </button>
                  </div>

                  {/* Status Filters */}
                  <div className="flex gap-2 items-center">
                    <span className="text-sm text-[var(--color-text-600)]">Status:</span>
                    <button
                      onClick={() => toggleStatus('not-scheduled')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('not-scheduled')
                          ? 'bg-gray-100 text-gray-700 border-gray-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Not scheduled
                    </button>
                    <button
                      onClick={() => toggleStatus('scheduled')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('scheduled')
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Scheduled
                    </button>
                    <button
                      onClick={() => toggleStatus('completed')}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                        selectedStatuses.includes('completed')
                          ? 'bg-green-100 text-green-700 border-green-200'
                          : 'bg-gray-50 text-gray-400 border-gray-200'
                      }`}
                    >
                      Completed
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Table (desktop) / Cards (mobile) */}
            {filteredGroups.length === 0 ? (
              <div className="p-12 text-center">
                <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
                <p className="text-[var(--color-text-600)]">No groups assigned yet.</p>
              </div>
            ) : (
              <>
                {/* ── DESKTOP: original table ── */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-[var(--color-border)] bg-gray-50">
                      <tr>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Project Name</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Course</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Milestone</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Date & Room</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Status</th>
                        <th className="text-left py-3 px-6 text-[var(--color-text-900)]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedGroups.map((group) => (
                        <tr
                          key={group.id}
                          className="border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div>
                              <p className="text-[var(--color-text-900)]">{group.projectName}</p>
                              <p className="text-sm text-[var(--color-text-600)]">{group.groupCode ?? group.groupId}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 text-sm rounded-full ${
                              group.course === 'CPIS-498'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-purple-100 text-purple-700 border border-purple-200'
                            }`}>
                              {group.course === 'CPIS-498' ? 'CPIS-498' : 'CPIS-499'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-[var(--color-text-900)]">
                            {group.milestone}
                          </td>
                          <td className="py-4 px-6">
                            {group.date && group.room ? (
                              <div>
                                <p className="text-[var(--color-text-900)]">{group.date}</p>
                                <p className="text-sm text-[var(--color-text-600)]">{group.room}</p>
                              </div>
                            ) : (
                              <span className="text-[var(--color-text-400)]">—</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <span className={`px-3 py-1 text-sm rounded-full ${
                              group.status === 'completed'
                                ? 'bg-green-100 text-green-700 border border-green-200'
                                : group.status === 'scheduled'
                                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                                : 'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                              {group.status === 'not-scheduled' ? 'Not scheduled' :
                               group.status === 'scheduled' ? 'Scheduled' : 'Completed'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <Button
                              onClick={() => handleEvaluate(group.groupId)}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              Evaluate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* ── MOBILE: stacked cards (no horizontal scroll) ── */}
                <div className="sm:hidden p-4 space-y-3">
                  {paginatedGroups.map((group) => (
                    <div
                      key={group.id}
                      className="bg-white border border-[var(--color-border)] rounded-xl p-4"
                    >
                      <p className="font-semibold text-[var(--color-text-900)] leading-snug">
                        {group.projectName}
                      </p>
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                        {group.groupCode ?? group.groupId}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                          group.course === 'CPIS-498'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-purple-100 text-purple-700 border-purple-200'
                        }`}>
                          {group.course === 'CPIS-498' ? 'CPIS-498' : 'CPIS-499'}
                        </span>
                        <span className="px-2.5 py-1 text-xs font-medium rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                          {group.milestone}
                        </span>
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${
                          group.status === 'completed'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : group.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {group.status === 'not-scheduled' ? 'Not scheduled' :
                           group.status === 'scheduled' ? 'Scheduled' : 'Completed'}
                        </span>
                      </div>
                      {(group.date || group.room) && (
                        <p className="text-xs text-[var(--color-text-600)] mt-2">
                          {[group.date, group.room].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={() => handleEvaluate(group.groupId)}
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          Evaluate
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="p-4 border-t border-[var(--color-border)] flex items-center justify-between">
                    <p className="text-sm text-[var(--color-text-600)]">
                      Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredGroups.length)} of {filteredGroups.length} groups
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </Button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={currentPage === page ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                        >
                          {page}
                        </Button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
      )}
    </Layout>
  );
}
