import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { getSubmissionById } from '../../services/submissions';
import { getMilestoneById } from '../../services/milestones';
import { useAuth } from '../../lib/AuthContext';
import { FileText, ChevronLeft, Check, AlertCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';
import type { Submission, Milestone } from '../../types';

export function SupervisorSubmissionReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getSubmissionById(id).then(async (sub) => {
      setSubmission(sub);
      if (sub) {
        const m = await getMilestoneById(sub.milestoneId);
        setMilestone(m);
      }
    }).finally(() => setLoading(false));
  }, [id]);
  
  const [rubricScores, setRubricScores] = useState<Record<string, { score: number; comment: string }>>(
    submission?.feedback?.rubric.reduce((acc, r) => ({
      ...acc,
      [r.id]: { score: r.score || 0, comment: r.comment || '' }
    }), {}) || {}
  );
  const [overallComment, setOverallComment] = useState(submission?.feedback?.overallComment || '');
  const [sendNotification, setSendNotification] = useState(true);
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false);
  const [changesMessage, setChangesMessage] = useState('');

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Review Submission"><div className="p-6">Loading...</div></Layout>;

  if (!submission || !milestone) {
    return (
      <Layout user={user} pageTitle="Review Not Found">
        <div className="text-center py-12">
          <p className="text-[var(--color-text-600)] mb-4">Submission not found</p>
          <Button onClick={() => navigate('/supervisor/reviews')}>Back to Reviews</Button>
        </div>
      </Layout>
    );
  }

  const totalScore = Object.values(rubricScores).reduce((sum, r) => sum + r.score, 0);
  const maxScore = milestone.rubric?.reduce((sum, r) => sum + r.maxScore, 0) || 0;

  const handleApprove = () => {
    toast.success('Submission approved successfully!');
    setTimeout(() => navigate('/supervisor/reviews'), 1000);
  };

  const handleRequestChanges = () => {
    if (!changesMessage.trim()) {
      toast.error('Please provide a message explaining the requested changes');
      return;
    }
    toast.success('Changes requested. Student has been notified.');
    setShowRequestChangesModal(false);
    setTimeout(() => navigate('/supervisor/reviews'), 1000);
  };

  const handleSaveDraft = () => {
    toast.success('Review saved as draft');
  };

  return (
    <Layout user={user} pageTitle="Review Submission">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/supervisor/reviews')}
          className="mb-4"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Back to Reviews Inbox
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[var(--color-text-900)] mb-2">{submission.projectName}</h1>
            <p className="text-[var(--color-text-600)] mb-1">{submission.milestoneName}</p>
            <p className="text-[var(--color-text-600)]">Student: {submission.studentName}</p>
          </div>
          <StatusBadge status={submission.status} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - File Preview */}
        <div className="col-span-2 space-y-6">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-[var(--color-primary-600)]" />
                <div>
                  <h2 className="text-[var(--color-text-900)]">{submission.versions[submission.currentVersion - 1].fileName}</h2>
                  <p className="text-[var(--color-text-600)]">
                    Version {submission.currentVersion} • {submission.versions[submission.currentVersion - 1].fileSize}
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Download
              </Button>
            </div>
            
            {/* File Preview Area */}
            <div className="p-6 bg-[var(--color-surface-alt)] min-h-[600px] flex items-center justify-center">
              <div className="text-center text-[var(--color-text-600)]">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>PDF Preview</p>
                <p className="mt-2">{submission.versions[submission.currentVersion - 1].fileName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Rubric & Comments */}
        <div className="space-y-6">
          {/* Rubric Panel */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
            <div className="p-6 border-b border-[var(--color-border)]">
              <h2 className="text-[var(--color-text-900)] mb-2">Grading Rubric</h2>
              <div className="flex items-center justify-between text-[var(--color-text-600)]">
                <span>Total Score</span>
                <span className="text-[var(--color-text-900)]">
                  {totalScore}/{maxScore}
                </span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {milestone.rubric?.map((criterion) => (
                <div key={criterion.id} className="space-y-3">
                  <div className="flex justify-between items-start">
                    <Label className="text-[var(--color-text-900)]">{criterion.name}</Label>
                    <span className="text-[var(--color-text-600)]">
                      /{criterion.maxScore}
                    </span>
                  </div>
                  
                  <Input
                    type="number"
                    min="0"
                    max={criterion.maxScore}
                    value={rubricScores[criterion.id]?.score || 0}
                    onChange={(e) => setRubricScores({
                      ...rubricScores,
                      [criterion.id]: {
                        ...rubricScores[criterion.id],
                        score: Math.min(Number(e.target.value), criterion.maxScore)
                      }
                    })}
                    className="w-full"
                    placeholder="Score"
                  />

                  <Textarea
                    value={rubricScores[criterion.id]?.comment || ''}
                    onChange={(e) => setRubricScores({
                      ...rubricScores,
                      [criterion.id]: {
                        ...rubricScores[criterion.id],
                        comment: e.target.value
                      }
                    })}
                    placeholder="Comments for this criterion..."
                    className="min-h-[80px]"
                  />
                </div>
              ))}

              <div className="pt-4 border-t border-[var(--color-border)]">
                <div className="bg-[var(--color-primary-100)] p-4 rounded-lg mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[var(--color-text-900)]">Total Score</span>
                    <span className="text-[var(--color-text-900)]">
                      {totalScore}/{maxScore} ({Math.round((totalScore / maxScore) * 100)}%)
                    </span>
                  </div>
                </div>

                <Label className="text-[var(--color-text-900)] mb-2 block">Overall Comments</Label>
                <Textarea
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  placeholder="Provide overall feedback on the submission..."
                  className="min-h-[120px]"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify" className="text-[var(--color-text-900)]">
                Send notification to student
              </Label>
              <Switch
                id="notify"
                checked={sendNotification}
                onCheckedChange={setSendNotification}
              />
            </div>

            <div className="pt-4 border-t border-[var(--color-border)] space-y-3">
              <Button
                variant="success"
                className="w-full gap-2"
                onClick={handleApprove}
              >
                <Check className="w-4 h-4" />
                Approve Submission
              </Button>
              
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setShowRequestChangesModal(true)}
              >
                <AlertCircle className="w-4 h-4" />
                Request Changes
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleSaveDraft}
              >
                Save Draft
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Request Changes Modal */}
      {showRequestChangesModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowRequestChangesModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full">
              <div className="p-6 border-b border-[var(--color-border)] flex items-center justify-between">
                <h2 className="text-[var(--color-text-900)]">Request Changes</h2>
                <button
                  onClick={() => setShowRequestChangesModal(false)}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <Label htmlFor="message" className="text-[var(--color-text-900)] mb-2 block">
                    Message to Student *
                  </Label>
                  <Textarea
                    id="message"
                    value={changesMessage}
                    onChange={(e) => setChangesMessage(e.target.value)}
                    placeholder="Explain what needs to be changed and provide guidance for improvement..."
                    className="min-h-[150px]"
                  />
                  <p className="text-[var(--color-text-600)] mt-2">
                    This message will be sent to the student along with the rubric feedback above.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRequestChangesModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleRequestChanges}
                  >
                    Send Request
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
