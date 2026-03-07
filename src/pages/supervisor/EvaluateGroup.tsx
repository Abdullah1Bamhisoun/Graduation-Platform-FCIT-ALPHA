/**
 * Supervisor — Evaluate Group (Full Page)
 *
 * Design matches GradesCommittee.tsx exactly:
 *   - Header card: group name + badges + Save Draft / Submit Grades / Mark IP
 *   - Two-column layout: accordion criteria list (left 70%) + summary sidebar (right 30%)
 *   - Per-criterion accordion rows with colored dot + "Not Graded" / score display
 *   - Expanded content: Likert card options (1-5) with descriptions
 *   - Right sidebar: live per-criterion score list, total, percentage, mini progress bar
 *   - Student selector tabs (when group has >1 student)
 *
 * Grading logic is unchanged:
 *   CPIS-498 / CPIS-499: supervisor_eval criteria × scale 1–5 → normalized to component marks
 */

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
  getRubricCriteria,
  type RubricCriterion,
} from '../../services/grading-rubric';
import {
  ArrowLeft,
  Save,
  Send,
  XCircle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  components: GradeComponent[];
  deliverablesTotal: number;
  supervisorEvaluation: SupervisorEvalEntry[];
  supervisorTotalScore: number | null;
  supervisorMaxScore: number;
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

// ─── API Helpers ──────────────────────────────────────────────────────────────

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

async function submitEvaluations(
  groupId: string,
  evaluations: { studentId: string; scores: Record<string, number> }[],
  submissionStatus: 'draft' | 'submitted',
  token: string
): Promise<{ results: { studentId: string; normalizedScore: number; maxScore: number; submissionStatus: string }[] }> {
  const res = await fetch(`/api/groups/${groupId}/supervisor-evaluation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ evaluations, submissionStatus }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Failed to submit evaluation');
  }
  return res.json();
}

// ─── Score color helper (matches GradesCommittee.tsx) ────────────────────────

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

export function SupervisorEvaluateGroup() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate    = useNavigate();
  const { user }    = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [group, setGroup]         = useState<GroupGradeData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [criteria, setCriteria]   = useState<RubricCriterion[]>([]);

  // scores[studentId][criterionKey] = rawScore (1–5)
  const [scores, setScores]       = useState<Record<string, Record<string, number>>>({});
  const [comments, setComments]   = useState<Record<string, string>>({});
  const [activeStudentId, setActiveStudentId] = useState('');

  // Accordion: only one criterion open at a time
  const [openCriterionId, setOpenCriterionId] = useState<string | null>(null);

  // Modals
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showIPModal, setShowIPModal]         = useState(false);
  const [ipReason, setIpReason]               = useState('');

  // ── Load group + criteria ──────────────────────────────────────────────────

  useEffect(() => {
    if (!user || !groupId) return;
    (async () => {
      try {
        const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
        const token   = session.data.session?.access_token ?? '';
        const data    = await fetchSupervisorGrades(token);
        const found   = data.find((g) => g.id === groupId);

        if (!found) {
          toast.error('Group not found');
          navigate('/supervisor/groups');
          return;
        }

        const crit = await getRubricCriteria(found.courseType, 'supervisor_eval');
        setCriteria(crit);

        // Pre-fill from existing rubric scores
        const prefill: Record<string, Record<string, number>> = {};
        for (const r of found.rubricScores) {
          if (!prefill[r.studentId]) prefill[r.studentId] = {};
          prefill[r.studentId][r.criterionKey] = r.rawScore;
        }
        setScores(prefill);
        setActiveStudentId(found.students[0]?.id ?? '');
        setGroup(found);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load group');
        navigate('/supervisor/groups');
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.id, groupId]);

  if (!user) return null;

  // ── Derived values for the active student ─────────────────────────────────

  const compWeight  = group?.components.find((c) => c.componentKey === 'supervisor_eval')?.totalMarks
    ?? group?.supervisorMaxScore ?? 0;
  const maxRawTotal = criteria.reduce((s, c) => s + c.maxRawScore, 0);

  const activeScores   = scores[activeStudentId] ?? {};
  const rawTotal       = criteria.reduce((s, c) => s + (activeScores[c.criterionKey] ?? 0), 0);
  const normalized     = maxRawTotal > 0 ? Math.round((rawTotal / maxRawTotal) * compWeight * 100) / 100 : 0;
  const percentage     = maxRawTotal > 0 ? Math.round((rawTotal / maxRawTotal) * 100) : 0;
  const gradedCount    = criteria.filter((c) => activeScores[c.criterionKey] !== undefined).length;
  const allFilled      = criteria.length > 0 && gradedCount === criteria.length;

  const evalEntry      = group?.supervisorEvaluation.find((e) => e.studentId === activeStudentId);
  const studentStatus  = evalEntry?.submissionStatus ?? 'draft';
  const isSubmitted    = studentStatus === 'submitted' || studentStatus === 'locked';
  const isReadOnly     = isSubmitted || isLocked;

  // ── Validate all students before final submit ──────────────────────────────

  const validateAll = (): boolean => {
    if (!group) return false;
    for (const student of group.students) {
      const sScores = scores[student.id] ?? {};
      const missing = criteria.filter((c) => !sScores[c.criterionKey]);
      if (missing.length > 0) {
        toast.error(`Please score all criteria for ${student.name} before submitting`);
        setActiveStudentId(student.id);
        setOpenCriterionId(null);
        return false;
      }
    }
    return true;
  };

  // ── Save draft ─────────────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!group || !user) return;
    setSaving(true);
    try {
      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
      const token   = session.data.session?.access_token ?? '';
      const evaluations = group.students.map((s) => ({
        studentId: s.id,
        scores: scores[s.id] ?? {},
      }));
      await submitEvaluations(group.id, evaluations, 'draft', token);
      toast.success('Draft saved successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit grades ──────────────────────────────────────────────────────────

  const handleSubmitGrades = () => {
    if (!validateAll()) return;
    setShowSubmitModal(true);
  };

  const confirmSubmitGrades = async () => {
    if (!group || !user) return;
    setShowSubmitModal(false);
    setSaving(true);
    try {
      const session = await import('../../lib/supabase').then((m) => m.supabase.auth.getSession());
      const token   = session.data.session?.access_token ?? '';
      const evaluations = group.students.map((s) => ({
        studentId: s.id,
        scores: scores[s.id] ?? {},
      }));
      await submitEvaluations(group.id, evaluations, 'submitted', token);
      toast.success('Grades submitted successfully');
      navigate('/supervisor/groups?tab=grades');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit grades');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark IP ────────────────────────────────────────────────────────────────

  const handleMarkIP = () => setShowIPModal(true);

  const confirmMarkIP = () => {
    if (!ipReason.trim()) {
      toast.error('Please provide a reason for marking as IP');
      return;
    }
    setShowIPModal(false);
    toast.success('Marked as IP (Not Ready)');
  };

  // ── Score change ───────────────────────────────────────────────────────────

  const handleScoreChange = (criterionKey: string, score: number) => {
    if (isReadOnly) return;
    setScores((prev) => ({
      ...prev,
      [activeStudentId]: { ...(prev[activeStudentId] ?? {}), [criterionKey]: score },
    }));
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout user={user} pageTitle="Evaluate & Grade">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout user={user} pageTitle="Evaluate & Grade">
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">Group not found</p>
        </div>
      </Layout>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Layout user={user} pageTitle="Evaluate & Grade">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        {/* Back button */}
        <Button
          variant="outline"
          onClick={() => navigate('/supervisor/groups?tab=grades')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Groups
        </Button>

        {/* Header card — matches GradesCommittee exactly */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <h1 className="text-[var(--color-text-900)]">
                  {group.projectName}
                </h1>
                <span className="px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700 border border-blue-200">
                  {group.courseType}
                </span>
                <span className={`px-3 py-1 text-sm rounded-full ${
                  isSubmitted
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {isSubmitted ? 'Submitted' : 'Draft'}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-600)]">
                {group.groupCode ?? `Group ${group.groupNumber}`}
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
                Submit Grades
              </Button>
              <Button
                variant="outline"
                onClick={handleMarkIP}
                className="text-red-600 border-red-300 hover:bg-red-50"
                disabled={isReadOnly}
              >
                <XCircle className="w-4 h-4 mr-2" />
                Mark IP
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Student selector tabs — shown when multiple students */}
      {group.students.length > 1 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {group.students.map((s) => {
            const scored   = criteria.filter((c) => (scores[s.id] ?? {})[c.criterionKey]).length;
            const allDone  = scored === criteria.length && criteria.length > 0;
            const sEntry   = group.supervisorEvaluation.find((e) => e.studentId === s.id);
            const sStatus  = sEntry?.submissionStatus ?? 'draft';
            const isActive = activeStudentId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveStudentId(s.id);
                  setOpenCriterionId(null);
                }}
                className={`px-4 py-2 text-sm rounded-lg border-2 transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-[var(--color-surface-white)] text-[var(--color-text-700)] border-[var(--color-border)] hover:border-green-400'
                }`}
              >
                {s.name}
                {sStatus === 'submitted' || sStatus === 'locked'
                  ? <CheckCircle className="w-3.5 h-3.5 opacity-80" />
                  : allDone
                  ? <CheckCircle className="w-3.5 h-3.5 opacity-60" />
                  : scored > 0
                  ? <span className="text-xs opacity-75">{scored}/{criteria.length}</span>
                  : null}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Evaluation Area — accordion left, summary right */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">

        {/* ── Left: Accordion criteria list (70%) ── */}
        <div className="w-full lg:flex-[7] min-w-0">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 lg:p-8">
            <div className="mb-6">
              <h3 className="text-[var(--color-text-900)] mb-2">
                {group.students.length > 1
                  ? `Supervisor Evaluation Matrix — ${group.students.find((s) => s.id === activeStudentId)?.name}`
                  : 'Supervisor Evaluation Matrix'}
              </h3>
              <p className="text-[var(--color-text-600)]">
                Evaluate {criteria.length} criteria using Likert scale (1–5).
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
                  const isOpen   = openCriterionId === criterion.criterionKey;
                  const score    = activeScores[criterion.criterionKey] ?? null;

                  return (
                    <div
                      key={criterion.criterionKey}
                      className="border border-[var(--color-border)] rounded-xl shadow-sm overflow-hidden"
                    >
                      {/* ── Collapsed Header ── */}
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-5 py-4 bg-[var(--color-surface-white)] hover:bg-gray-50 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
                        onClick={() =>
                          setOpenCriterionId(isOpen ? null : criterion.criterionKey)
                        }
                        aria-expanded={isOpen}
                      >
                        <span className="font-medium text-[var(--color-text-900)] pr-4">
                          {criterion.criterionName}
                        </span>

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

                          {/* Colour dot */}
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0 border border-white shadow-sm"
                            style={{ backgroundColor: getScoreColor(score) }}
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
                            {Array.from({ length: criterion.maxRawScore }, (_, i) => i + 1)
                              .filter((s) => !!(criterion[`description${s}` as keyof RubricCriterion] as string | undefined))
                              .map((s) => {
                              const desc = criterion[`description${s}` as keyof RubricCriterion] as string | undefined;
                              const isSelected = score === s;

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
                No rubric criteria found. Run docs/sql/001_full_grading_system.sql in Supabase.
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
              <Label htmlFor="supervisor-comments" className="mb-2 block text-[var(--color-text-900)]">
                Comments for Supervisor Evaluation
              </Label>
              <Textarea
                id="supervisor-comments"
                value={comments[activeStudentId] ?? ''}
                onChange={(e) =>
                  setComments((p) => ({ ...p, [activeStudentId]: e.target.value }))
                }
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
              Supervisor Evaluation Summary
            </h4>

            <div className="space-y-0">
              {criteria.map((c) => {
                const s = activeScores[c.criterionKey] ?? null;
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
        </div>
      </div>

      {/* ── Submit Grades Confirmation Modal ── */}
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
              {group.students.map((s) => {
                const sScores = scores[s.id] ?? {};
                const sRaw    = criteria.reduce((sum, c) => sum + (sScores[c.criterionKey] ?? 0), 0);
                const sNorm   = maxRawTotal > 0
                  ? Math.round((sRaw / maxRawTotal) * compWeight * 100) / 100
                  : 0;
                return (
                  <div key={s.id} className="flex justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-blue-900"><strong>{s.name}:</strong></span>
                    <span className="text-blue-900">
                      <strong>{sRaw}/{maxRawTotal} raw → {sNorm.toFixed(1)}/{compWeight}</strong>
                    </span>
                  </div>
                );
              })}
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
            <Button
              onClick={confirmSubmitGrades}
              className="!bg-green-600 hover:!bg-green-700 text-white"
              disabled={saving}
            >
              <Send className="w-4 h-4 mr-2" />
              Submit Grades
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Mark IP Modal ── */}
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
            <Button onClick={confirmMarkIP} className="bg-red-600 hover:bg-red-700 text-white">
              Confirm Mark IP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
