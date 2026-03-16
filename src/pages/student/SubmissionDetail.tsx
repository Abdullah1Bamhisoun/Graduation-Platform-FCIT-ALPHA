import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../lib/AuthContext';
import { getMilestoneById } from '../../services/milestones';
import {
  getSubmissionByMilestoneAndGroup,
  getSubmissionByMilestoneAndStudent,
  createSubmission,
  createSubmissionVersion,
} from '../../services/submissions';
import { getGroupForStudent, GroupData } from '../../services/groups';
import { uploadSubmissionFile, getSignedUrl, deleteStorageFile } from '../../services/storage';
import { Upload, FileText, Clock, MessageSquare, Download, X, AlertCircle, Lock, Send, Loader2, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Milestone, Submission } from '../../types';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { DocumentViewerWithAnnotations } from '../../components/DocumentViewerWithAnnotations';

interface SubmissionComment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorRole: 'student' | 'supervisor';
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StudentSubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isLocked } = useLockStatus('submissions');
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [submission, setSubmission] = useState<Submission | undefined>(undefined);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    // Load milestone and group in parallel, then look up submission by group
    Promise.all([
      getMilestoneById(id),
      getGroupForStudent(user.id),
    ]).then(async ([m, g]) => {
      setMilestone(m);
      setGroup(g);
      if (g) {
        const s = await getSubmissionByMilestoneAndGroup(id, g.id);
        setSubmission(s ?? undefined);
      }
    }).finally(() => setLoading(false));
  }, [user, id]);

  // Load discussion comments when we know the submission id
  useEffect(() => {
    if (!submission?.id || !user) return;
    setCommentsLoading(true);
    import('../../lib/supabase')
      .then((m) => m.supabase.auth.getSession())
      .then(async (session) => {
        const token = session.data.session?.access_token ?? '';
        const res = await fetch(`/api/submissions/${submission.id}/comments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data: SubmissionComment[] = await res.json();
        setComments(data);
      })
      .catch(() => { /* silently ignore – discussion is non-critical */ })
      .finally(() => setCommentsLoading(false));
  }, [submission?.id, user]);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [comments, setComments] = useState<SubmissionComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);
  const [viewerFile, setViewerFile] = useState<{ url: string; filePath: string; fileName: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Loading..."><div className="p-6">Loading...</div></Layout>;

  if (!milestone) {
    return (
      <Layout user={user} pageTitle="Submission Not Found">
        <div className="text-center py-12">
          <p className="text-[var(--color-text-600)] mb-4">Milestone not found</p>
          <Button onClick={() => navigate('/student/milestones')}>Back to Milestones</Button>
        </div>
      </Layout>
    );
  }

  const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.zip', '.rar'];
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/vnd.rar',
  ];

  const onFileSelect = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be under 10MB');
      return;
    }
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(file.type)) {
      toast.error(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
      return;
    }
    setSelectedFile(file);
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !user || !id) return;
    if (!group) {
      toast.error('You must be in a group to submit');
      return;
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    try {
      uploadedPath = await uploadSubmissionFile(selectedFile, user.id, id);
      const fileSize = formatFileSize(selectedFile.size);

      if (submission) {
        const nextVersion = submission.currentVersion + 1;
        await createSubmissionVersion(submission.id, {
          version: nextVersion,
          fileName: selectedFile.name,
          fileSize,
          filePath: uploadedPath,
        });
      } else {
        await createSubmission({
          milestoneId: id,
          studentId: user.id,
          groupId: group.id,
          fileName: selectedFile.name,
          fileSize,
          filePath: uploadedPath,
        });
      }

      const updated = await getSubmissionByMilestoneAndStudent(id, user.id);
      setSubmission(updated ?? undefined);
      setSelectedFile(null);
      toast.success('File uploaded successfully!');
    } catch (err) {
      // Roll back orphaned storage file if DB step failed after upload succeeded
      if (uploadedPath) {
        deleteStorageFile(uploadedPath).catch(() => {});
      }
      const errMessage = (err as any)?.message as string | undefined;
      console.error('Upload error:', err);
      if (errMessage?.includes('Bucket not found')) {
        toast.error('Storage bucket not found. Contact an administrator.');
      } else if (errMessage?.includes('row-level security') || errMessage?.includes('Unauthorized') || (err as any)?.statusCode === 403 || (err as any)?.status === 403) {
        toast.error('Permission denied. Contact an administrator to configure storage access.');
      } else {
        toast.error(errMessage ? `Upload failed: ${errMessage}` : 'Upload failed. Please try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
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
      toast.error('Failed to get download link');
    }
  };

  const handleView = async (filePath: string, fileName?: string) => {
    try {
      const url = await getSignedUrl(filePath);
      setViewerFile({ url, filePath, fileName: fileName ?? filePath.split('/').pop() ?? 'File' });
    } catch {
      toast.error('Failed to get file URL');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFileSelect(file);
  };

  const now = new Date();
  const openDate = new Date(milestone.openDate);
  const dueDate = new Date(milestone.dueDate);
  const isBeforeOpen = now < openDate;
  const isPastDeadline = now > dueDate;
  // Block uploads if: platform locked, deadline passed, OR submission already exists from a teammate
  const submittedByTeammate = !!submission && submission.studentId !== user.id;
  const uploadsBlocked = isLocked || (isPastDeadline && !milestone.allowLateSubmission);

  return (
    <>
    <Layout user={user} pageTitle={milestone.name}>
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/student/milestones')}
          className="mb-4 bg-[var(--color-surface-white)] border border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]"
        >
          ← Back to Milestones
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--color-text-900)] mb-2">{milestone.name}</h1>
            <p className="text-[var(--color-text-600)]">
              Due: {dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <StatusBadge status={milestone.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - File Preview & Upload */}
        <div className="col-span-1 lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4">
              {submittedByTeammate ? 'Chapter Submission' : submission ? 'Update Submission' : 'Upload Submission'}
            </h2>

            {/* Teammate submitted banner */}
            {submittedByTeammate && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 mb-4">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-blue-700 text-sm">
                  This chapter was submitted by <span className="font-semibold">{submission.studentName}</span>. All group members share this submission.
                </p>
              </div>
            )}

            {/* Submission Closed banner */}
            {isPastDeadline && !milestone.allowLateSubmission && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 mb-4">
                <Lock className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-red-700 font-medium">Submission Closed</p>
                  <p className="text-red-600 text-sm">
                    The deadline passed on {dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. No further uploads are accepted.
                  </p>
                </div>
              </div>
            )}

            {/* Late submission warning */}
            {isPastDeadline && milestone.allowLateSubmission && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 mb-4">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-amber-700 text-sm">
                  The deadline has passed. Late submissions are accepted for this milestone.
                </p>
              </div>
            )}

            {/* Not yet open notice */}
            {isBeforeOpen && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-blue-50 border border-blue-200 mb-4">
                <AlertCircle className="w-5 h-5 text-blue-500 shrink-0" />
                <p className="text-blue-700 text-sm">
                  Submissions open on {openDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
                </p>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.rar"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelect(file);
                e.target.value = '';
              }}
            />

            {/* Drop zone — hidden when submission is fully closed */}
            {!uploadsBlocked && !isBeforeOpen && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors cursor-pointer ${
                dragging
                  ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-100)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary-600)]'
              }`}
            >
              <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-600)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">
                Drag and drop your file here
              </h3>
              <p className="text-[var(--color-text-600)] mb-4">or click to browse</p>
              <p className="text-[var(--color-text-600)]">
                Supported formats: PDF, Word, PowerPoint, ZIP, RAR (Max 10MB)
              </p>
            </div>
            )}

            {/* Selected file preview */}
            {selectedFile && (
              <div className="mt-4 flex items-center gap-3 p-3 border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-alt)]">
                <FileText className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--color-text-900)] truncate">{selectedFile.name}</p>
                  <p className="text-[var(--color-text-600)]">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-[var(--color-border)] rounded"
                >
                  <X className="w-4 h-4 text-[var(--color-text-600)]" />
                </button>
              </div>
            )}

            {/* Upload button */}
            {selectedFile && (
              <div className="mt-4">
                <Button
                  onClick={handleFileUpload}
                  disabled={uploading || uploadsBlocked}
                  className="w-full"
                >
                  {uploading ? 'Uploading...' : `Upload${submission ? ' New Version' : ''}`}
                </Button>
              </div>
            )}
          </div>

          {/* Version History */}
          {submission && submission.versions.length > 0 && (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-[var(--color-text-900)]">Version History</h2>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {submission.versions.map((version) => (
                  <div key={version.version} className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 !bg-white dark:bg-blue-950/30 rounded-lg flex items-center justify-center border-[1.5px] border-blue-500 dark:border-blue-900/50">
                        <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-[var(--color-text-900)] mb-1">
                          Version {version.version}
                        </h3>
                        <p className="text-[var(--color-text-600)]">
                          {version.fileName} • {version.fileSize}
                        </p>
                        <p className="text-[var(--color-text-600)]">
                          {new Date(version.uploadedAt).toLocaleString()}
                        </p>
                        {version.notes && (
                          <p className="text-[var(--color-text-600)] mt-1 italic">
                            Note: {version.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {version.filePath ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleView(version.filePath!, version.fileName)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(version.filePath!, version.fileName)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback — overall comment only, no rubric/scores */}
          {submission?.feedback?.overallComment && (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-[var(--color-text-900)]">Supervisor Feedback</h2>
              </div>
              <div className="p-6">
                <div className="bg-[var(--color-surface-alt)] p-4 rounded-lg">
                  <p className="text-[var(--color-text-900)] mb-3">{submission.feedback.overallComment}</p>
                  <div className="flex items-center gap-3 text-[var(--color-text-600)]">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center">
                      {submission.feedback.reviewedBy.charAt(0)}
                    </div>
                    <div>
                      <p>{submission.feedback.reviewedBy}</p>
                      <p>{new Date(submission.feedback.reviewedAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Group Info, Timeline & Comments */}
        <div className="space-y-6">
          {/* Group Info Card */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Group Submission
            </h2>
            {submission && (
              <div className="mb-3 pb-3 border-b border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-600)] mb-1">Submitted by</p>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-semibold">
                    {submission.studentName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-[var(--color-text-900)]">
                    {submission.studentName}
                    {submission.studentId === user.id && (
                      <span className="ml-1.5 text-xs text-[var(--color-text-600)]">(you)</span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-600)] mt-1">
                  {new Date(submission.submittedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
            <p className="text-xs text-[var(--color-text-600)] mb-2">Group Members</p>
            <div className="flex flex-wrap gap-1.5">
              {(submission?.groupMembers ?? group?.members ?? []).map((m) => (
                <span
                  key={m.id}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    m.id === user.id
                      ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-200)] font-semibold'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-600)] border-[var(--color-border)]'
                  }`}
                >
                  {m.name}{m.id === user.id ? ' (you)' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Status Timeline */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4">Status Timeline</h2>
            <div className="space-y-4">
              {submission ? (
                <>
                  {submission.feedback && (
                    <div className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div className="w-0.5 h-full bg-[var(--color-border)] mt-2"></div>
                      </div>
                      <div className="flex-1 pb-4">
                        <p className="text-[var(--color-text-900)] mb-1">Changes Requested</p>
                        <p className="text-[var(--color-text-600)]">
                          {new Date(submission.feedback.reviewedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      {submission.versions.length > 1 && <div className="w-0.5 h-full bg-[var(--color-border)] mt-2"></div>}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-[var(--color-text-900)] mb-1">Submitted</p>
                      <p className="text-[var(--color-text-600)]">
                        {new Date(submission.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {submission.versions.length > 1 && (
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[var(--color-text-900)] mb-1">Initial Draft</p>
                        <p className="text-[var(--color-text-600)]">
                          {new Date(submission.versions[0].uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-[var(--color-text-600)]">
                  <p>No submission yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Discussion */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Discussion
            </h2>

            {/* Comment thread */}
            <div className="space-y-3 mb-4 max-h-[320px] overflow-y-auto">
              {commentsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-400)]" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-[var(--color-text-500)] text-sm text-center py-4">
                  No messages yet. Ask your supervisor a question below.
                </p>
              ) : (
                comments.map((c) => {
                  const isMe = c.authorId === user.id;
                  const isSupervisor = c.authorRole === 'supervisor';
                  const alignRight = isMe;

                  const avatarColor = isMe
                    ? 'bg-emerald-500'
                    : isSupervisor
                    ? 'bg-[var(--color-primary-600)]'
                    : 'bg-violet-500';

                  const bubbleClass = isMe
                    ? 'bg-emerald-500 text-white rounded-tr-sm'
                    : isSupervisor
                    ? 'bg-[var(--color-surface-alt)] text-[var(--color-text-900)] border border-[var(--color-border)] rounded-tl-sm'
                    : 'bg-violet-100 text-violet-900 border border-violet-200 rounded-tl-sm';

                  const label = isMe
                    ? `${c.authorName} · You`
                    : isSupervisor
                    ? `${c.authorName} · Supervisor`
                    : c.authorName;

                  return (
                    <div key={c.id} className={`flex gap-2 ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor}`}
                      >
                        {c.authorName.charAt(0).toUpperCase()}
                      </div>
                      <div className={`max-w-[80%] flex flex-col gap-0.5 ${alignRight ? 'items-end' : 'items-start'}`}>
                        <span className="text-[10px] text-[var(--color-text-500)] px-1">
                          {label}
                        </span>
                        <div className={`rounded-2xl px-3 py-2 text-sm ${bubbleClass}`}>
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

            {/* Compose */}
            <div className="space-y-2">
              <Textarea
                placeholder="Ask your supervisor a question or share an update…"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[80px] resize-none"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    if (!submission?.id || !newComment.trim() || commentPosting) return;
                    setCommentPosting(true);
                    try {
                      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
                      const token = session.data.session?.access_token ?? '';
                      const res = await fetch(`/api/submissions/${submission.id}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ content: newComment.trim() }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || 'Failed to post comment');
                      }
                      const comment: SubmissionComment = await res.json();
                      setComments((prev) => [...prev, comment]);
                      setNewComment('');
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to post comment');
                    } finally {
                      setCommentPosting(false);
                    }
                  }
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-400)]">Ctrl+Enter to send</span>
                <Button
                  size="sm"
                  className="gap-1.5"
                  disabled={!submission?.id || !newComment.trim() || commentPosting}
                  onClick={async () => {
                    if (!submission?.id || !newComment.trim()) return;
                    setCommentPosting(true);
                    try {
                      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
                      const token = session.data.session?.access_token ?? '';
                      const res = await fetch(`/api/submissions/${submission.id}/comments`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ content: newComment.trim() }),
                      });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({}));
                        throw new Error(err.error || 'Failed to post comment');
                      }
                      const comment: SubmissionComment = await res.json();
                      setComments((prev) => [...prev, comment]);
                      setNewComment('');
                    } catch (err: any) {
                      toast.error(err?.message || 'Failed to post comment');
                    } finally {
                      setCommentPosting(false);
                    }
                  }}
                >
                  {commentPosting
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Send className="w-3.5 h-3.5" />
                  }
                  Send
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

    </Layout>
    {viewerFile && (
      <DocumentViewerWithAnnotations
        fileUrl={viewerFile.url}
        filePath={viewerFile.filePath}
        fileName={viewerFile.fileName}
        onClose={() => setViewerFile(null)}
        userId={user.id}
        userName={user.name}
        userRole={user.activeRole}
      />
    )}
    </>
  );
}
