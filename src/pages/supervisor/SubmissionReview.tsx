import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/AuthContext';
import {
  ChevronLeft,
  FileText,
  Eye,
  Download,
  Send,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';
import { getSignedUrl } from '../../services/storage';
import { DocumentViewerWithAnnotations } from '../../components/DocumentViewerWithAnnotations';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  versions: {
    version: number;
    file_name: string;
    file_size: string;
    file_path: string | null;
    uploaded_at: string;
  }[];
  hasFeedback: boolean;
  latestFeedback: { overall_comment: string; reviewed_at: string } | null;
}

interface SubmissionComment {
  id: string;
  content: string;
  authorName: string;
  authorRole: 'student' | 'supervisor';
  createdAt: string;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchChapterSubmissions(token: string): Promise<ChapterSubmission[]> {
  const res = await fetch('/api/submissions/chapter-submissions', {
    headers: { Authorization: `Bearer ${token}`, 'X-Active-Role': 'supervisor' },
  });
  if (!res.ok) throw new Error('Failed to fetch chapter submissions');
  return res.json();
}

async function submitApproval(
  submissionId: string,
  action: 'approve' | 'request_changes',
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

async function fetchComments(submissionId: string, token: string): Promise<SubmissionComment[]> {
  const res = await fetch(`/api/submissions/${submissionId}/comments`, {
    headers: { Authorization: `Bearer ${token}`, 'X-Active-Role': 'supervisor' },
  });
  if (!res.ok) {
    if (res.status >= 500) return [];
    throw new Error('Failed to fetch comments');
  }
  return res.json();
}

async function postComment(
  submissionId: string,
  content: string,
  token: string
): Promise<SubmissionComment> {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function draftKey(submissionId: string) {
  return `review_draft_${submissionId}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SupervisorSubmissionReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [submission, setSubmission] = useState<ChapterSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // File viewer
  const [viewerFile, setViewerFile] = useState<{ url: string; filePath: string; fileName: string } | null>(null);

  // Feedback / draft
  const [feedback, setFeedback] = useState('');

  // Discussion
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // ── Token helper ────────────────────────────────────────────────────────────
  const getToken = async () => {
    const session = await import('../../lib/supabase').then((m) =>
      m.supabase.auth.getSession()
    );
    return session.data.session?.access_token ?? '';
  };

  // ── Load submission ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const token = await getToken();
        const all = await fetchChapterSubmissions(token);
        const found = all.find((s) => s.id === id) ?? null;
        setSubmission(found);
        if (found) {
          // Pre-populate feedback from localStorage draft
          const saved = localStorage.getItem(draftKey(found.id));
          if (saved) setFeedback(saved);
        }
      } catch {
        toast.error('Failed to load submission');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // ── Load comments ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    (async () => {
      setCommentsLoading(true);
      try {
        const token = await getToken();
        const data = await fetchComments(id, token);
        setComments(data);
      } catch {
        // non-fatal
      } finally {
        setCommentsLoading(false);
      }
    })();
  }, [id]);

  // Scroll to bottom when comments change
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // ── File actions ────────────────────────────────────────────────────────────
  const handleViewFile = async (filePath: string, fileName: string) => {
    try {
      const url = await getSignedUrl(filePath);
      setViewerFile({ url, filePath, fileName });
    } catch {
      toast.error('Failed to get file URL');
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

  // ── Draft ────────────────────────────────────────────────────────────────────
  const handleSaveDraft = () => {
    if (!submission) return;
    localStorage.setItem(draftKey(submission.id), feedback);
    toast.success('Draft saved');
  };

  // ── Request Changes ──────────────────────────────────────────────────────────
  const handleRequestChanges = async () => {
    if (!submission) return;
    if (!feedback.trim()) {
      toast.error('Feedback is required when requesting changes');
      return;
    }
    setProcessing(true);
    try {
      const token = await getToken();
      await submitApproval(submission.id, 'request_changes', feedback.trim(), token);
      setSubmission((prev) => prev ? { ...prev, status: 'changes-requested' } : prev);
      toast.success('Changes requested — student has been notified');
      // Keep draft in case supervisor wants to revisit
    } catch (err: any) {
      toast.error(err.message || 'Failed to request changes');
    } finally {
      setProcessing(false);
    }
  };

  // ── Approve ──────────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!submission) return;
    setProcessing(true);
    try {
      const token = await getToken();
      await submitApproval(submission.id, 'approve', feedback.trim(), token);
      setSubmission((prev) => prev ? { ...prev, status: 'approved' } : prev);
      // Clear draft on approval
      localStorage.removeItem(draftKey(submission.id));
      toast.success(`${submission.milestoneName} approved`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve submission');
    } finally {
      setProcessing(false);
    }
  };

  // ── Post comment ─────────────────────────────────────────────────────────────
  const handlePostComment = async () => {
    if (!submission || !newComment.trim()) return;
    setPosting(true);
    try {
      const token = await getToken();
      const comment = await postComment(submission.id, newComment.trim(), token);
      setComments((prev) => [...prev, comment]);
      setNewComment('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to post comment');
    } finally {
      setPosting(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────────
  if (!user) return null;

  if (loading) {
    return (
      <Layout user={user} pageTitle="Review Submission">
        <div className="flex items-center justify-center min-h-40 p-6">
          <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-400)]" />
        </div>
      </Layout>
    );
  }

  if (!submission) {
    return (
      <Layout user={user} pageTitle="Review Not Found">
        <div className="text-center py-12">
          <p className="text-[var(--color-text-600)] mb-4">Submission not found</p>
          <Button onClick={() => navigate('/supervisor/groups?tab=chapter-submission')}>
            Back to Chapter Submissions
          </Button>
        </div>
      </Layout>
    );
  }

  const latestVersion = submission.versions[submission.versions.length - 1];
  const filePath = latestVersion?.file_path ?? null;
  const fileName = latestVersion?.file_name ?? 'file';
  const isActionable =
    submission.status === 'submitted' || submission.status === 'under-review';

  if (viewerFile) {
    return (
      <DocumentViewerWithAnnotations
        fileUrl={viewerFile.url}
        filePath={viewerFile.filePath}
        fileName={viewerFile.fileName}
        onClose={() => setViewerFile(null)}
        userId={user.id}
        userName={user.name}
        userRole={user.activeRole}
      />
    );
  }

  return (
    <Layout user={user} pageTitle="Review Submission">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/supervisor/groups?tab=chapter-submission')}
        className="mb-4 gap-2 bg-[var(--color-surface-white)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Chapter Submissions
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-[var(--color-text-900)] text-xl font-semibold">
            {submission.milestoneName}
          </h1>
          <p className="text-[var(--color-text-600)] mt-1">
            {submission.projectName}
            {submission.groupNumber != null && (
              <span className="ml-2 text-[var(--color-text-500)]">· Group {submission.groupNumber}</span>
            )}
          </p>
          <p className="text-[var(--color-text-600)] text-sm mt-0.5">
            Submitted by <span className="font-medium text-[var(--color-text-900)]">{submission.studentName}</span>
            {' '}· {formatDate(submission.submittedAt)}
          </p>
        </div>
        <StatusBadge status={submission.status as any} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">

        {/* ── Left column: file + feedback + actions ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* File card */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-3">
              <FileText className="w-5 h-5 text-[var(--color-primary-600)]" />
              <div className="flex-1 min-w-0">
                <p className="text-[var(--color-text-900)] font-medium truncate">{fileName}</p>
                <p className="text-[var(--color-text-600)] text-sm">
                  Version {submission.currentVersion}
                  {latestVersion?.file_size && ` · ${latestVersion.file_size}`}
                </p>
              </div>
              {filePath ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleViewFile(filePath, fileName)}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => handleDownloadFile(filePath, fileName)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </Button>
                </div>
              ) : (
                <span className="text-[var(--color-text-400)] text-sm">No file attached</span>
              )}
            </div>
          </div>

          {/* Feedback textarea */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
            <Label className="text-[var(--color-text-900)] font-medium block mb-2">
              Review Feedback
              {isActionable && (
                <span className="ml-1 text-red-500 text-sm font-normal">
                  * required for changes
                </span>
              )}
            </Label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Write your feedback for the student here…"
              className="min-h-[180px] resize-y"
            />
            {localStorage.getItem(draftKey(submission.id)) && (
              <p className="text-xs text-[var(--color-text-500)] mt-1.5">Draft auto-loaded</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5 space-y-3">
            {/* Save Draft */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleSaveDraft}
              disabled={processing}
            >
              Save Draft
            </Button>

            {/* Request Changes */}
            <Button
              className="w-full gap-2 !bg-red-500 hover:!bg-red-600 text-white border-red-500"
              onClick={handleRequestChanges}
              disabled={processing || !isActionable}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Request Changes
            </Button>

            {/* Approve */}
            <Button
              className="w-full gap-2 !bg-green-600 hover:!bg-green-700 text-white border-green-600"
              onClick={handleApprove}
              disabled={processing || !isActionable}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Approve Submission
            </Button>

            {!isActionable && (
              <p className="text-xs text-[var(--color-text-500)] text-center">
                Status: <span className="font-medium">{submission.status.replace(/-/g, ' ')}</span>
              </p>
            )}
          </div>
        </div>

        {/* ── Right column: discussion ── */}
        <div className="flex flex-col">

          {/* Discussion */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] flex flex-col flex-1">
            <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center gap-2 flex-shrink-0">
              <MessageSquare className="w-4 h-4 text-[var(--color-text-600)]" />
              <h2 className="text-[var(--color-text-900)] font-medium">Discussion</h2>
              {comments.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-[var(--color-primary-100)] text-[var(--color-primary-700)] text-xs font-semibold">
                  {comments.length}
                </span>
              )}
            </div>

            {/* Comments list */}
            <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto">
              {commentsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-400)]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[var(--color-text-500)] text-sm text-center py-6">
                  No messages yet. Start the discussion below.
                </p>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className={`flex gap-3 ${c.authorRole === 'supervisor' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${
                        c.authorRole === 'supervisor'
                          ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)]'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {c.authorName.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-2.5 ${
                        c.authorRole === 'supervisor'
                          ? 'bg-[var(--color-primary-600)] text-white'
                          : 'bg-[var(--color-surface-alt)] text-[var(--color-text-900)]'
                      }`}
                    >
                      <p className="text-sm">{c.content}</p>
                      <p
                        className={`text-xs mt-1 ${
                          c.authorRole === 'supervisor' ? 'text-blue-100' : 'text-[var(--color-text-500)]'
                        }`}
                      >
                        {c.authorName} · {formatDate(c.createdAt)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-2 flex-shrink-0">
              <input
                type="text"
                className="flex-1 px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)] text-[var(--color-text-900)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-400)]"
                placeholder="Type a message…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostComment();
                  }
                }}
                disabled={posting}
              />
              <Button
                size="sm"
                onClick={handlePostComment}
                disabled={posting || !newComment.trim()}
                className="gap-1"
              >
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

    </Layout>
  );
}
