import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../lib/AuthContext';
import { Star } from 'lucide-react';
import { toast } from 'sonner';
import { getGroupForStudent } from '../../services/groups';
import { createPeerEvaluation } from '../../services/grades';
import { supabase } from '../../lib/supabase';

interface GroupMember { id: string; name: string; studentId?: string; }

export function StudentPeerFeedback() {
  const { user } = useAuth();
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [courseCode, setCourseCode] = useState<string>('CPIS-498');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [evaluations, setEvaluations] = useState<Record<string, { rating: number; comment: string }>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const group = await getGroupForStudent(user.id);
        if (group) {
          setGroupId(group.id);
          setCourseCode(group.courseCode || 'CPIS-498');
          const peers = group.members.filter((m) => m.id !== user.id);
          setGroupMembers(peers);

          // Check if this student already submitted peer evaluations for this group
          const { data: existing } = await supabase
            .from('peer_evaluations')
            .select('id')
            .eq('evaluator_id', user.id)
            .eq('group_id', group.id)
            .limit(1);

          if (existing && existing.length > 0) {
            setSubmitted(true);
          }
        }
      } finally {
        setLoadingMembers(false);
      }
    })();
  }, [user]);

  const handleRatingChange = (studentId: string, rating: number) => {
    setEvaluations({
      ...evaluations,
      [studentId]: {
        rating,
        comment: evaluations[studentId]?.comment || '',
      },
    });
  };

  const handleCommentChange = (studentId: string, comment: string) => {
    setEvaluations({
      ...evaluations,
      [studentId]: {
        rating: evaluations[studentId]?.rating || 0,
        comment,
      },
    });
  };

  const handleSubmit = async () => {
    const allRated = groupMembers.every(member => evaluations[member.id]?.rating > 0);
    if (!allRated) {
      toast.error('Please rate all group members before submitting');
      return;
    }
    if (!groupId || !user) return;

    setSubmitting(true);
    try {
      for (const member of groupMembers) {
        const ev = evaluations[member.id];
        await createPeerEvaluation({
          studentId: member.id,
          evaluatorId: user.id,
          groupId,
          courseCode,
          score: ev.rating,
          comment: ev.comment || undefined,
        });
      }
      setSubmitted(true);
      toast.success('Peer feedback submitted successfully!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit peer feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const calculateAverageContribution = () => {
    const ratings = Object.values(evaluations).map(e => e.rating).filter(r => r > 0);
    if (ratings.length === 0) return 0;
    return (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1);
  };

  if (!user) return null;
  if (loadingMembers) return <Layout user={user} pageTitle="Peer Feedback (5 Marks)"><div className="p-6">Loading...</div></Layout>;

  return (
    <Layout user={user} pageTitle="Peer Feedback (5 Marks)">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Evaluate your group members' performance and contribution (5% of total assessment)
        </p>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-[var(--color-text-900)]">
            <strong>Important:</strong> Your honest feedback helps ensure fair evaluation. Rate each member's contribution, communication, and collaboration.
          </p>
        </div>
      </div>

      {groupMembers.length === 0 && !submitted && (
        <div className="text-center py-12 text-[var(--color-text-600)]">
          <p>No group members to evaluate. You must be assigned to a group first.</p>
        </div>
      )}

      {submitted ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl text-[var(--color-text-900)] mb-2">Peer Feedback Submitted!</h2>
          <p className="text-[var(--color-text-600)]">
            Thank you for your feedback. Your evaluations have been recorded.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupMembers.map((member) => (
            <div key={member.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
              <div className="p-6 border-b border-[var(--color-border)]">
                <h3 className="text-[var(--color-text-900)] mb-1">{member.name}</h3>
                <p className="text-[var(--color-text-600)]">Student ID: {member.studentId || member.id}</p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <Label className="mb-3 block">Rate Performance (1-5 stars) *</Label>
                  <div className="flex items-center gap-6">
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRatingChange(member.id, star)}
                          className="transition-all hover:scale-110"
                        >
                          <Star
                            className={`w-10 h-10 ${
                              evaluations[member.id]?.rating >= star
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    {evaluations[member.id]?.rating > 0 && (
                      <div className={`text-2xl ${getRatingColor(evaluations[member.id].rating)}`}>
                        {evaluations[member.id].rating}.0
                      </div>
                    )}
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-[var(--color-text-600)]">
                      <strong>5 stars:</strong> Exceptional - Goes above and beyond
                    </p>
                    <p className="text-[var(--color-text-600)]">
                      <strong>4 stars:</strong> Very Good - Consistently contributes well
                    </p>
                    <p className="text-[var(--color-text-600)]">
                      <strong>3 stars:</strong> Good - Meets expectations
                    </p>
                    <p className="text-[var(--color-text-600)]">
                      <strong>2 stars:</strong> Fair - Needs improvement
                    </p>
                    <p className="text-[var(--color-text-600)]">
                      <strong>1 star:</strong> Poor - Minimal contribution
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor={`comment-${member.id}`}>Comments (Optional)</Label>
                  <Textarea
                    id={`comment-${member.id}`}
                    value={evaluations[member.id]?.comment || ''}
                    onChange={(e) => handleCommentChange(member.id, e.target.value)}
                    placeholder="Provide specific feedback about their contribution, communication, and teamwork..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Summary */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
            <h3 className="text-[var(--color-text-900)] mb-4">Evaluation Summary</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--color-text-900)] mb-2">Average Rating Given</p>
                <div className="flex items-center gap-2">
                  <Star className="w-6 h-6 fill-yellow-400 text-yellow-400" />
                  <span className="text-2xl text-[var(--color-text-900)]">{calculateAverageContribution()}</span>
                </div>
              </div>
              <div>
                <p className="text-[var(--color-text-900)] mb-2">Members Evaluated</p>
                <div className="text-2xl text-[var(--color-text-900)]">
                  {Object.keys(evaluations).filter(id => evaluations[id]?.rating > 0).length} / {groupMembers.length}
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button
              onClick={handleSubmit}
              disabled={submitting || Object.keys(evaluations).filter(id => evaluations[id]?.rating > 0).length !== groupMembers.length}
              className="bg-[#10B981] text-black hover:bg-[#0ea572]"
            >
              {submitting ? 'Submitting…' : 'Submit Peer Feedback'}
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}
