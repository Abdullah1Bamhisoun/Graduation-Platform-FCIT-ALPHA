import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { mockUsers, mockMilestones, mockSubmissions } from '../../lib/mock-data';
import { Upload, FileText, Clock, MessageSquare, Download } from 'lucide-react';
import { toast } from 'sonner';

export function StudentSubmissionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = mockUsers.student;
  const milestone = mockMilestones.find(m => m.id === id);
  const submission = mockSubmissions.find(s => s.milestoneId === id);
  const [uploading, setUploading] = useState(false);
  const [newComment, setNewComment] = useState('');

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

  const handleFileUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      toast.success('File uploaded successfully!');
    }, 1500);
  };

  return (
    <Layout user={user} pageTitle={milestone.name}>
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
              Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
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
            
            <div className="border-2 border-dashed border-[var(--color-border)] rounded-lg p-12 text-center hover:border-[var(--color-primary-600)] transition-colors cursor-pointer">
              <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-600)]" />
              <h3 className="text-[var(--color-text-900)] mb-2">
                Drag and drop your file here
              </h3>
              <p className="text-[var(--color-text-600)] mb-4">or click to browse</p>
              <Button
                onClick={handleFileUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Select File'}
              </Button>
              <p className="text-[var(--color-text-600)] mt-4">
                Supported formats: PDF (Max 10MB)
              </p>
            </div>
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
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
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
                      H
                    </div>
                    <div className="flex-1">
                      <p className="text-[var(--color-text-900)]">Dr Hasan Labani</p>
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
