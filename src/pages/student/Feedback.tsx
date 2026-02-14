import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { useAuth } from '../../lib/AuthContext';
import { getSubmissionsForStudent } from '../../services/submissions';
import { BarChart3, Info } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { X } from 'lucide-react';
import type { Submission } from '../../types';

export function StudentFeedback() {
  const { user } = useAuth();
  const [showGradeCalc, setShowGradeCalc] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getSubmissionsForStudent(user.id)
      .then(setSubmissions)
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Feedback & Grades"><div className="p-6">Loading...</div></Layout>;

  const submissionsWithFeedback = submissions.filter(s => s.feedback);

  return (
    <Layout user={user} pageTitle="Feedback & Grades">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          View detailed feedback and grades for your submissions
        </p>
      </div>

      <div className="space-y-6">
        {submissionsWithFeedback.map((submission) => {
          if (!submission.feedback) return null;

          return (
            <div key={submission.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
              <div className="p-6 border-b border-[var(--color-border)]">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-[var(--color-text-900)] mb-2">{submission.milestoneName}</h2>
                    <p className="text-[var(--color-text-600)]">
                      Reviewed by {submission.feedback.reviewedBy} • {new Date(submission.feedback.reviewedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={submission.status} />
                </div>

                {/* Score Summary */}
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-[var(--color-primary-100)] rounded-lg p-4">
                    <p className="text-[var(--color-text-600)] mb-1">Total Score</p>
                    <p className="text-[var(--color-text-900)]">
                      {submission.feedback.totalScore}/{submission.feedback.maxScore}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-alt)] rounded-lg p-4">
                    <p className="text-[var(--color-text-600)] mb-1">Percentage</p>
                    <p className="text-[var(--color-text-900)]">
                      {Math.round((submission.feedback.totalScore / submission.feedback.maxScore) * 100)}%
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-alt)] rounded-lg p-4">
                    <p className="text-[var(--color-text-600)] mb-1">Letter Grade</p>
                    <p className="text-[var(--color-text-900)]">
                      {submission.feedback.totalScore / submission.feedback.maxScore >= 0.9 ? 'A' :
                       submission.feedback.totalScore / submission.feedback.maxScore >= 0.8 ? 'B' : 'C'}
                    </p>
                  </div>
                  <div className="bg-[var(--color-surface-alt)] rounded-lg p-4">
                    <p className="text-[var(--color-text-600)] mb-1">Criteria Met</p>
                    <p className="text-[var(--color-text-900)]">
                      {submission.feedback.rubric.filter(r => r.score && r.score >= r.maxScore * 0.7).length}/{submission.feedback.rubric.length}
                    </p>
                  </div>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div className="p-6">
                <h3 className="text-[var(--color-text-900)] mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Rubric Breakdown
                </h3>
                
                <div className="space-y-4">
                  {submission.feedback.rubric.map((criterion) => {
                    const percentage = criterion.score ? (criterion.score / criterion.maxScore) * 100 : 0;
                    const color = percentage >= 80 ? 'bg-green-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-red-500';
                    
                    return (
                      <div key={criterion.id} className="border border-[var(--color-border)] rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h4 className="text-[var(--color-text-900)] mb-1">{criterion.name}</h4>
                            <div className="flex items-center gap-3">
                              <span className="text-[var(--color-text-900)]">
                                {criterion.score}/{criterion.maxScore} points
                              </span>
                              <span className="text-[var(--color-text-600)]">
                                ({Math.round(percentage)}%)
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-2 mb-3">
                          <div
                            className={`${color} h-full rounded-full transition-all`}
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>

                        {/* Comment */}
                        {criterion.comment && (
                          <div className="bg-[var(--color-surface-alt)] p-3 rounded-lg">
                            <p className="text-[var(--color-text-600)]">{criterion.comment}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Overall Feedback */}
                <div className="mt-6 p-4 bg-white border border-blue-200 rounded-lg">
                  <h4 className="text-blue-900 mb-2">Overall Feedback</h4>
                  <p className="text-blue-800">{submission.feedback.overallComment}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Grade Calculation Info */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-[var(--color-info)] mt-0.5" />
            <div className="flex-1">
              <h3 className="text-[var(--color-text-900)] mb-2">How Your Grade is Calculated</h3>
              <p className="text-[var(--color-text-600)] mb-4">
                Your final grade for CPIS-498/499 is based on multiple milestones with different weights.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowGradeCalc(true)}
              >
                View Grading Breakdown
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Grade Calculation Modal */}
      {showGradeCalc && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowGradeCalc(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6 flex items-center justify-between">
                <h2 className="text-[var(--color-text-900)]">Grading Breakdown</h2>
                <button
                  onClick={() => setShowGradeCalc(false)}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="space-y-4">
                  <div className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-[var(--color-text-900)]">Weekly Reports (Weeks 5-13)</span>
                      <span className="text-[var(--color-text-900)]">20%</span>
                    </div>
                    <p className="text-[var(--color-text-600)]">
                      Regular progress updates and communication with your supervisor
                    </p>
                  </div>

                  <div className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-[var(--color-text-900)]">Chapter Submissions (1-4)</span>
                      <span className="text-[var(--color-text-900)]">40%</span>
                    </div>
                    <p className="text-[var(--color-text-600)]">
                      Individual chapter quality, depth, and adherence to guidelines
                    </p>
                  </div>

                  <div className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-[var(--color-text-900)]">Final Report</span>
                      <span className="text-[var(--color-text-900)]">25%</span>
                    </div>
                    <p className="text-[var(--color-text-600)]">
                      Complete integrated report with all chapters and results
                    </p>
                  </div>

                  <div className="border border-[var(--color-border)] rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-[var(--color-text-900)]">Poster & Presentation</span>
                      <span className="text-[var(--color-text-900)]">15%</span>
                    </div>
                    <p className="text-[var(--color-text-600)]">
                      Final presentation and poster quality, clarity, and delivery
                    </p>
                  </div>

                  <div className="border-2 border-[var(--color-primary-600)] rounded-lg p-4 bg-[var(--color-primary-100)]">
                    <div className="flex justify-between">
                      <span className="text-[var(--color-text-900)]">Total</span>
                      <span className="text-[var(--color-text-900)]">100%</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-[var(--color-surface-alt)] rounded-lg">
                  <p className="text-[var(--color-text-600)]">
                    <strong>Note:</strong> All grades are subject to review and approval by the course coordinator. 
                    Late submissions may be penalized unless prior approval is granted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
