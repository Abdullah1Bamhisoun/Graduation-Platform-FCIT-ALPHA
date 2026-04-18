import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import {
  getCoordinatorRubricCriteria,
  getCoordinatorEvalComponent,
  type RubricCriterion,
  type GradingComponent,
} from '../../services/grading-rubric';
import {
  getCoordinatorGroupsWithGrades,
  getCoordinatorEvaluation,
  submitCoordinatorEvaluation,
  type CoordinatorGroupWithGrades,
} from '../../services/groups';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Save,
  Send,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Score color helper ───────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function CoordinatorEvaluateGroup() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [group, setGroup]           = useState<CoordinatorGroupWithGrades | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [criteria, setCriteria]     = useState<RubricCriterion[]>([]);
  const [evalComponent, setEvalComponent] = useState<GradingComponent | null>(null);

  // scores[criterionKey] = rawScore (1–5)
  const [scores, setScores]         = useState<Record<string, number>>({});
  const [comment, setComment]       = useState('');
  const [existingStatus, setExistingStatus] = useState<'draft' | 'submitted' | null>(null);

  // deliverable scores from Chapter Submissions: criterionKey → { score, maxScore }
  const [delivScores, setDelivScores] = useState<Record<string, { score: number; maxScore: number }>>({});

  // Accordion: only one criterion open at a time
  const [openCriterionId, setOpenCriterionId] = useState<string | null>(null);

  // Submit confirmation modal
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // ── Load group + criteria ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !groupId) return;
    (async () => {
      try {
        const groups = await getCoordinatorGroupsWithGrades(
          // We fetch all groups; courseType is on the group
          '498',
          user.activeRole ?? 'coordinator'
        );
        let found = groups.find((g) => g.id === groupId);

        // Try 499 if not found in 498
        if (!found) {
          const groups499 = await getCoordinatorGroupsWithGrades('499', user.activeRole ?? 'coordinator');
          found = groups499.find((g) => g.id === groupId);
        }

        if (!found) {
          toast.error('Group not found');
          navigate('/coordinator/grades?tab=groups-evaluation');
          return;
        }

        const courseId = user.coordinatorCourseId ?? '';

        const [crit, comp, existingEval, delivRows, assessRow] = await Promise.all([
          getCoordinatorRubricCriteria(found.courseType),
          getCoordinatorEvalComponent(found.courseType),
          getCoordinatorEvaluation(groupId, found.courseType, user.activeRole ?? 'coordinator'),
          courseId
            ? supabase
                .from('coordinator_deliverable_scores')
                .select('deliverable_key, score, max_score')
                .eq('group_id', groupId)
                .eq('course_id', courseId)
            : Promise.resolve({ data: [] }),
          supabase
            .from('coordinator_assessments')
            .select('comment')
            .eq('group_id', groupId)
            .eq('course_type', found.courseType)
            .maybeSingle(),
        ]);

        setCriteria(crit);
        setEvalComponent(comp);
        setExistingStatus(existingEval.submissionStatus);
        setComment((assessRow as any).data?.comment ?? '');

        // Build deliverable score lookup
        const dMap: Record<string, { score: number; maxScore: number }> = {};
        for (const row of (delivRows as any).data ?? []) {
          dMap[row.deliverable_key] = { score: Number(row.score), maxScore: Number(row.max_score) };
        }
        setDelivScores(dMap);

        // Pre-fill rubric scores: prefer existing rubric eval, then fall back to deliverable scores
        const prefill: Record<string, number> = {};
        for (const c of crit) prefill[c.criterionKey] = 0;
        for (const item of existingEval.evaluations ?? []) {
          if (item.rawScore) prefill[item.criterionKey] = item.rawScore;
        }
        // If no rubric score for a criterion, pre-fill from Chapter Submissions deliverable score
        for (const c of crit) {
          if (prefill[c.criterionKey] === 0 && dMap[c.criterionKey]) {
            const ds = dMap[c.criterionKey];
            // Clamp decimal deliverable score to integer within [1, maxRawScore]
            const clamped = Math.min(Math.max(Math.round(ds.score), 1), c.maxRawScore);
            if (ds.score > 0) prefill[c.criterionKey] = clamped;
          }
        }
        setScores(prefill);

        setGroup(found);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load group');
        navigate('/coordinator/grades?tab=groups-evaluation');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, groupId]);

  if (!user) return null;

  // ── Derived values ─────────────────────────────────────────────────────────

  const compWeight  = evalComponent?.totalMarks ?? 20;
  const maxRawTotal = criteria.reduce((s, c) => s + c.maxRawScore, 0);
  const rawTotal    = criteria.reduce((s, c) => s + (scores[c.criterionKey] ?? 0), 0);
  const normalized  = maxRawTotal > 0 ? Math.round((rawTotal / maxRawTotal) * compWeight * 100) / 100 : 0;
  const percentage  = maxRawTotal > 0 ? Math.round((rawTotal / maxRawTotal) * 100) : 0;
  const gradedCount = criteria.filter((c) => (scores[c.criterionKey] ?? 0) > 0).length;
  const allFilled   = criteria.length > 0 && gradedCount === criteria.length;

  const isSubmitted = existingStatus === 'submitted';
  const isReadOnly  = isLocked;

  // ── Score change ───────────────────────────────────────────────────────────

  const handleScoreChange = (criterionKey: string, score: number) => {
    if (isReadOnly) return;
    setScores((prev) => ({ ...prev, [criterionKey]: score }));
  };

  // ── Save draft ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!group || !user) return;
    setSaving(true);
    try {
      const evaluations = criteria.map((c) => ({
        criterionId: c.id,
        criterionKey: c.criterionKey,
        rawScore: scores[c.criterionKey] ?? 0,
      }));
      await submitCoordinatorEvaluation(
        group.id,
        { courseType: group.courseType, evaluations, comment: comment.trim() || null, submissionStatus: 'draft' },
        user.activeRole ?? 'coordinator'
      );
      setExistingStatus('draft');
      toast.success('Draft saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmitGrades = () => {
    const unscored = criteria.filter((c) => (scores[c.criterionKey] ?? 0) === 0);
    if (unscored.length > 0) {
      toast.error(`Please score all criteria first. Missing: ${unscored.map((c) => c.criterionName).join(', ')}`);
      return;
    }
    setShowSubmitModal(true);
  };

  const confirmSubmit = async () => {
    if (!group || !user) return;
    setShowSubmitModal(false);
    setSaving(true);
    try {
      const evaluations = criteria.map((c) => ({
        criterionId: c.id,
        criterionKey: c.criterionKey,
        rawScore: scores[c.criterionKey] ?? 0,
      }));
      await submitCoordinatorEvaluation(
        group.id,
        { courseType: group.courseType, evaluations, comment: comment.trim() || null, submissionStatus: 'submitted' },
        user.activeRole ?? 'coordinator'
      );
      setExistingStatus('submitted');
      toast.success('Evaluation submitted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit evaluation');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout user={user} pageTitle="Evaluate Group">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout user={user} pageTitle="Evaluate Group">
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">Group not found</p>
        </div>
      </Layout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout user={user} pageTitle="Evaluate Group">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => navigate('/coordinator/grades?tab=groups-evaluation')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Groups
        </Button>

        {/* Header card */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-[var(--color-text-900)]">
                  {group.name}
                </h1>
                <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {group.courseType}
                </span>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  isSubmitted
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : existingStatus === 'draft'
                    ? 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {isSubmitted ? 'Submitted' : existingStatus === 'draft' ? 'Draft' : 'Not Started'}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-600)]">
                {group.groupCode ?? `Group ${group.number}`}
                {group.supervisorName && (
                  <> · Supervisor: <strong>{group.supervisorName}</strong></>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving || isReadOnly}>
                <Save className="w-4 h-4 mr-2" />
                Save Draft
              </Button>
              <Button
                onClick={handleSubmitGrades}
                className="!bg-green-600 hover:!bg-green-700 text-white"
                disabled={saving || isReadOnly}
              >
                <Send className="w-4 h-4 mr-2" />
                {isSubmitted ? 'Re-submit Evaluation' : 'Submit Evaluation'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main area — accordion left, summary right */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Accordion criteria list (70%) ── */}
        <div className="w-full lg:flex-[7] min-w-0">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 lg:p-8">
            <div className="mb-6">
              <h3 className="text-[var(--color-text-900)] mb-2">
                {evalComponent?.componentName ?? 'Coordinator Evaluation Matrix'}
              </h3>
              <p className="text-[var(--color-text-600)]">
                Evaluate {criteria.length} criteria using Likert scale (1–{criteria[0]?.maxRawScore ?? 5}).
                Scores are normalized to {compWeight} marks.
              </p>
            </div>

            {/* Progress bar */}
            {criteria.length > 0 && (
              <div className="mb-6">
                <div className="flex justify-between text-xs text-[var(--color-text-600)] mb-1">
                  <span>{gradedCount} of {criteria.length} criteria graded</span>
                  <span>{rawTotal} / {maxRawTotal}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all duration-300"
                    style={{ width: maxRawTotal > 0 ? `${(rawTotal / maxRawTotal) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            )}

            {/* Accordion items */}
            {criteria.length > 0 ? (
              <div className="space-y-3">
                {criteria.map((criterion) => {
                  const isOpen = openCriterionId === criterion.criterionKey;
                  const score  = scores[criterion.criterionKey] > 0 ? scores[criterion.criterionKey] : null;
                  const delivRef = delivScores[criterion.criterionKey] ?? null;

                  return (
                    <div
                      key={criterion.criterionKey}
                      className="border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* Collapsed Header */}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 bg-[var(--color-surface-white)] hover:bg-gray-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                        onClick={() => setOpenCriterionId(isOpen ? null : criterion.criterionKey)}
                        aria-expanded={isOpen}
                      >
                        <div className="pr-4">
                          <span className="font-medium text-[var(--color-text-900)]">
                            {criterion.criterionName}
                          </span>
                          {delivRef !== null && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium">
                              Chapter Submissions: {delivRef.score}/{delivRef.maxScore}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 flex-shrink-0">
                          {score !== null ? (
                            <span className="text-sm text-[var(--color-text-600)]">
                              Score:&nbsp;
                              <strong className="text-[var(--color-text-900)]">
                                {score} / {criterion.maxRawScore}
                              </strong>
                            </span>
                          ) : (
                            <span className="text-sm italic text-[var(--color-text-400)]">
                              Not Graded
                            </span>
                          )}

                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                            style={{ backgroundColor: getScoreColor(score) }}
                            aria-hidden="true"
                          />

                          <ChevronDown
                            className={`w-5 h-5 text-[var(--color-text-400)] transition-transform duration-300 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {isOpen && (
                        <div className="border-t border-[var(--color-border)] bg-gray-50 px-5 py-5">
                          {delivRef !== null && (
                            <div className="mb-3 flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-800">
                              <CheckCircle className="w-3.5 h-3.5 shrink-0 text-purple-600" />
                              Graded in Chapter Submissions: <strong>{delivRef.score} / {delivRef.maxScore}</strong>
                              {score !== null && score !== Math.min(Math.max(Math.round(delivRef.score), 1), criterion.maxRawScore) && (
                                <span className="ml-1 text-purple-600">(you adjusted to {score})</span>
                              )}
                            </div>
                          )}
                          <div className="space-y-3">
                            {Array.from({ length: criterion.maxRawScore }, (_, i) => i + 1)
                              .map((s) => {
                                const desc = criterion[`description${s}` as keyof RubricCriterion] as string | undefined;
                                const isSelected = (scores[criterion.criterionKey] ?? 0) === s;

                                return (
                                  <label
                                    key={s}
                                    className={`flex items-start gap-4 p-4 rounded-lg border-2 transition-all ${
                                      isReadOnly ? 'cursor-not-allowed' : 'cursor-pointer'
                                    } ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`criterion-${criterion.criterionKey}`}
                                      checked={isSelected}
                                      onChange={() => handleScoreChange(criterion.criterionKey, s)}
                                      disabled={isReadOnly}
                                      className="mt-1 w-4 h-4 flex-shrink-0 accent-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span
                                          className="text-sm font-bold"
                                          style={{ color: getScoreColor(s) }}
                                        >
                                          {s}
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
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
                <AlertCircle className="w-5 h-5 inline mr-2" />
                No rubric criteria found. Please contact the system administrator.
              </div>
            )}

            {/* Unfilled warning */}
            {criteria.length > 0 && !allFilled && !isReadOnly && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2 text-sm text-amber-900">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Some criteria are not scored yet</span>
              </div>
            )}

            {/* Comments */}
            <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
              <Label htmlFor="coordinator-comments" className="mb-2 block text-[var(--color-text-900)]">
                Comment / Overall Feedback (Optional)
              </Label>
              <Textarea
                id="coordinator-comments"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Overall notes / justification for the scores..."
                className="min-h-[150px]"
                disabled={isReadOnly}
              />
            </div>
          </div>
        </div>

        {/* ── Right: Live Summary Panel (30%) ── */}
        <div className="w-full lg:flex-[3] lg:sticky lg:top-6 self-start">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm p-5">
            <h4 className="font-semibold text-[var(--color-text-900)] mb-4">
              Evaluation Summary
            </h4>

            <div className="space-y-0">
              {criteria.map((c) => {
                const s = scores[c.criterionKey] > 0 ? scores[c.criterionKey] : null;
                return (
                  <div
                    key={c.criterionKey}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm text-[var(--color-text-600)] pr-2 leading-snug">
                      {c.criterionName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s !== null ? (
                        <>
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getScoreColor(s) }}
                            aria-hidden="true"
                          />
                          <span className="text-sm font-semibold text-[var(--color-text-900)] tabular-nums">
                            {s}&nbsp;/&nbsp;{c.maxRawScore}
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-[var(--color-text-400)]">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t-2 border-gray-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--color-text-900)]">Total</span>
                <span className="font-bold text-lg text-[var(--color-text-900)] tabular-nums">
                  {rawTotal}&nbsp;/&nbsp;{maxRawTotal}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-600)]">Normalized</span>
                <span className="text-sm font-semibold text-[var(--color-text-900)] tabular-nums">
                  {normalized.toFixed(1)}&nbsp;/&nbsp;{compWeight}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-text-600)]">Percentage</span>
                <span className="text-sm font-semibold text-[var(--color-text-900)] tabular-nums">
                  {percentage}%
                </span>
              </div>

              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: percentage >= 80 ? '#16a34a' : percentage >= 60 ? '#eab308' : '#ef4444',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submit Confirmation Modal */}
      <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Submit Evaluation</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit the evaluation for this group?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200 text-sm">
              <span className="text-blue-900"><strong>Group {group.number} — {group.name}</strong></span>
              <span className="text-blue-900">
                <strong>{rawTotal}/{maxRawTotal} raw → {normalized.toFixed(1)}/{compWeight}</strong>
              </span>
            </div>
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900">
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Evaluation will be visible to admin. You can re-edit until grades are locked.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmSubmit}
              className="!bg-green-600 hover:!bg-green-700 text-white"
              disabled={saving}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Evaluation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
