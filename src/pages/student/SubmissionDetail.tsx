import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../lib/AuthContext';
import { getMilestoneById } from '../../services/milestones';
import {
  getSubmissionByMilestoneAndStudent,
  createSubmission,
  createSubmissionVersion,
} from '../../services/submissions';
import { getGroupForStudent, GroupData } from '../../services/groups';
import { uploadSubmissionFile, getSignedUrl, deleteStorageFile } from '../../services/storage';
import { Upload, FileText, Clock, MessageSquare, Download, X, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'sonner';
import type { Milestone, Submission } from '../../types';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';

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
  const [supervisorName, setSupervisorName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) return;
    Promise.all([
      getMilestoneById(id),
      getSubmissionByMilestoneAndStudent(id, user.id),
      getGroupForStudent(user.id),
    ]).then(([m, s, g]) => {
      setMilestone(m);
      setSubmission(s ?? undefined);
      setSupervisorName(g?.supervisorName ?? '');
      setGroup(g);
    }).finally(() => setLoading(false));
  }, [user, id]);

  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [newComment, setNewComment] = useState('');
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
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    } catch {
      toast.error('Failed to get download link');
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
  const uploadsBlocked = isLocked || (isPastDeadline && !milestone.allowLateSubmission);

  return (
    <Layout user={user} pageTitle={milestone.name}>
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/student/milestones')}
          className="mb-4"
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

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - File Preview & Upload */}
        <div className="col-span-2 space-y-6">
          {/* Upload Area */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4">Upload Submission</h2>

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
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(version.filePath!, version.fileName)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
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

          {/* Feedback */}
          {submission?.feedback && (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h2 className="text-[var(--color-text-900)]">Feedback & Rubric</h2>
              </div>
              <div className="p-6 space-y-6">
                {/* Rubric Scores */}
                <div>
                  <h3 className="text-[var(--color-text-900)] mb-3">Rubric Breakdown</h3>
                  <div className="space-y-3">
                    {submission.feedback.rubric.map((criterion) => (
                      <div key={criterion.id} className="border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[var(--color-text-900)]">{criterion.name}</span>
                          <span className="text-[var(--color-text-900)]">
                            {criterion.score}/{criterion.maxScore}
                          </span>
                        </div>
                        {criterion.comment && (
                          <p className="text-[var(--color-text-600)] bg-[var(--color-surface-alt)] p-3 rounded">
                            {criterion.comment}
                          </p>
                        )}
                      </div>
                    ))}
                    <div className="border-2 border-[var(--color-primary-600)] rounded-lg p-4 bg-[var(--color-primary-100)]">
                      <div className="flex justify-between items-center">
                        <span className="text-[var(--color-text-900)]">Total Score</span>
                        <span className="text-[var(--color-text-900)]">
                          {submission.feedback.totalScore}/{submission.feedback.maxScore}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Comment */}
                <div>
                  <h3 className="text-[var(--color-text-900)] mb-3">Overall Feedback</h3>
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
            </div>
          )}
        </div>

        {/* Right Column - Timeline & Comments */}
        <div className="space-y-6">
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

          {/* Comments */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h2 className="text-[var(--color-text-900)] mb-4 flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Discussion
            </h2>

            <div className="space-y-4 mb-4">
              {submission?.feedback && (
                <div className="border border-[var(--color-border)] rounded-lg p-3 bg-[var(--color-surface-alt)]">
                  <div className="flex items-start gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-[var(--color-primary-600)] text-white flex items-center justify-center flex-shrink-0">
                      {supervisorName ? supervisorName[0].toUpperCase() : 'S'}
                    </div>
                    <div className="flex-1">
                      <p className="text-[var(--color-text-900)]">{supervisorName || 'Supervisor'}</p>
                      <p className="text-[var(--color-text-600)]">Supervisor</p>
                    </div>
                  </div>
                  <p className="text-[var(--color-text-900)]">
                    Please review the feedback above and address the comments in your next version.
                  </p>
                </div>
              )}
            </div>

            <div>
              <Textarea
                placeholder="Add a comment or question..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-3"
              />
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  toast.success('Comment posted');
                  setNewComment('');
                }}
              >
                Post Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
