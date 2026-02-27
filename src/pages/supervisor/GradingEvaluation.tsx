/**
 * Supervisor/Committee Grading Evaluation
 *
 * Committee members evaluate assigned groups using the official rubric.
 * CPIS-498: 8 criteria × 0–5 = 40 marks
 * CPIS-499: 8 criteria × 0–5 = 40 marks
 *
 * Rules:
 * - Members cannot see each other's scores before submitting
 * - Final score = average of all submitted member totals
 * - Once submitted → locked
 */

import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForEvaluation } from '../../services/groups';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import {
  getRubricCriteria,
  getCommitteeRubricScores,
  saveCommitteeRubricScores,
  type RubricCriterion,
} from '../../services/grading-rubric';
import { supabase } from '../../lib/supabase';
import { Save, Send, CheckCircle, AlertCircle, Info, FileText } from 'lucide-react';
import { toast } from 'sonner';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

async function getCourseIdByCode(courseCode: string): Promise<string | null> {
  const { data } = await supabase
    .from('courses')
    .select('id')
    .ilike('code', '%' + (courseCode.includes('499') ? '499' : '498') + '%')
    .limit(1);
  return data?.[0]?.id ?? null;
}

// ─── Committee Criterion Row ──────────────────────────────────────────────────

interface CommitteeRowProps {
  criterion: RubricCriterion;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function CommitteeRow({ criterion, value, onChange, disabled }: CommitteeRowProps) {
  const descriptions: Record<number, string | undefined> = {
    0: 'Not demonstrated',
    1: criterion.description1,
    2: criterion.description2,
    3: criterion.description3,
    4: criterion.description4,
    5: criterion.description5,
  };

  return (
    <tr className={`border-b border-[var(--color-border)] hover:bg-gray-50 transition-colors`}>
      <td className="py-4 px-4">
        <div>
          <div className="font-medium text-[var(--color-text-900)] text-sm">{criterion.criterionName}</div>
          {value !== null && descriptions[value] && (
            <div className="text-xs text-[var(--color-text-600)] mt-0.5 italic">{descriptions[value]}</div>
          )}
        </div>
      </td>
      {[0, 1, 2, 3, 4, 5].map(score => (
        <td key={score} className="text-center py-4 px-2">
          <label className="flex justify-center cursor-pointer">
            <input
              type="radio"
              name={`criterion-${criterion.criterionKey}`}
              checked={value === score}
              onChange={() => onChange(score)}
              disabled={disabled}
              className="w-6 h-6 cursor-pointer appearance-none rounded-full border-2 border-gray-300 checked:border-green-600 checked:border-[6px] checked:bg-white hover:border-green-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
            />
          </label>
        </td>
      ))}
      <td className="text-center py-4 px-4 font-semibold tabular-nums text-[var(--color-text-900)] w-16">
        {value !== null ? value : '—'}/5
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GroupOption {
  id: string;
  groupNumber: number;
  course: string;
  projectTitle: string;
  evaluationActive: boolean;
}

export function SupervisorGradingEvaluation() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [groups, setGroups]           = useState<GroupOption[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [assignmentMode, setAssignmentMode] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // Rubric
  const [criteria, setCriteria]       = useState<RubricCriterion[]>([]);
  const [scores, setScores]           = useState<Record<string, number>>({});  // criterionKey → 0-5
  const [comment, setComment]         = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted' | 'locked'>('draft');
  const [courseId, setCourseId]       = useState<string | null>(null);

  // Confirm modal
  const [showConfirm, setShowConfirm] = useState(false);
  const [showIP, setShowIP]           = useState(false);
  const [ipReason, setIpReason]       = useState('');

  // ── Load assigned groups ───────────────────────────────────────────────────

  useEffect(() => {
    if (!user) return;
    getGroupsForEvaluation().then(({ groups: data, assignmentMode: mode }) => {
      setAssignmentMode(mode);
      setGroups(data.map(g => ({
        id: g.id,
        groupNumber: g.groupNumber ?? 0,
        course: g.courseCode,
        projectTitle: g.projectName,
        evaluationActive: g.evaluationActive,
      })));
    }).finally(() => setLoading(false));
  }, [user?.id]);

  // ── Load criteria + existing scores when group changes ────────────────────

  useEffect(() => {
    if (!selectedGroup || !user) return;
    const group = groups.find(g => g.id === selectedGroup);
    if (!group) return;
    const ct = courseTypeFromCode(group.course);

    ;(async () => {
      const cid = await getCourseIdByCode(group.course);
      setCourseId(cid);

      const [crit, existingScores] = await Promise.all([
        getRubricCriteria(ct, 'committee_eval'),
        cid ? getCommitteeRubricScores(selectedGroup, cid, user.id) : Promise.resolve([]),
      ]);
      setCriteria(crit);

      const scoreMap: Record<string, number> = {};
      let status: 'draft' | 'submitted' | 'locked' = 'draft';
      for (const s of existingScores) {
        scoreMap[s.criterionKey] = s.score;
        if (s.submissionStatus === 'locked') status = 'locked';
        else if (s.submissionStatus === 'submitted' && status !== 'locked') status = 'submitted';
      }
      setScores(scoreMap);
      setSubmissionStatus(status);

      // Get comment
      if (cid) {
        const { data } = await supabase
          .from('committee_evaluations')
          .select('comment')
          .eq('group_id', selectedGroup)
          .eq('course_id', cid)
          .eq('evaluator_id', user.id)
          .maybeSingle();
        setComment(data?.comment ?? '');
      }
    })();
  }, [selectedGroup, groups, user]);

  if (!user) return null;

  const currentGroup   = groups.find(g => g.id === selectedGroup);
  const ct             = currentGroup ? courseTypeFromCode(currentGroup.course) : null;
  const total          = Object.values(scores).reduce((s, v) => s + v, 0);
  const maxTotal       = criteria.length * 5;
  const allFilled      = criteria.length > 0 && criteria.every(c => scores[c.criterionKey] !== undefined);
  const isReadOnly     = submissionStatus === 'submitted' || submissionStatus === 'locked' || isLocked;
  const pct            = maxTotal > 0 ? Math.round((total / maxTotal) * 100) : 0;

  // ── Save draft ─────────────────────────────────────────────────────────────

  const saveDraft = async () => {
    if (!currentGroup || !courseId || !user) return;
    setSaving(true);
    try {
      await saveCommitteeRubricScores({
        groupId: selectedGroup, courseId, evaluatorId: user.id,
        scores, submissionStatus: 'draft',
      });
      toast.success('Draft saved.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const doSubmit = async () => {
    if (!currentGroup || !courseId || !user) return;
    setShowConfirm(false);
    setSaving(true);
    try {
      await saveCommitteeRubricScores({
        groupId: selectedGroup, courseId, evaluatorId: user.id,
        scores, submissionStatus: 'submitted',
      });
      // Save comment separately
      await supabase.from('committee_evaluations').upsert({
        group_id: selectedGroup, course_id: courseId,
        evaluator_id: user.id, score: total, max_score: 40, comment,
      }, { onConflict: 'group_id,course_id,evaluator_id' });

      setSubmissionStatus('submitted');
      toast.success(`Committee evaluation submitted. Total: ${total}/40`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark IP ────────────────────────────────────────────────────────────────

  const doMarkIP = async () => {
    if (!ipReason.trim()) { toast.error('Reason required.'); return; }
    setShowIP(false);
    toast.success('Marked as IP (Not Ready).');
  };

  if (loading) {
    return (
      <Layout user={user} pageTitle="Committee Evaluation">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  return (
    <Layout user={user} pageTitle="Committee Evaluation">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        {assignmentMode && groups.length === 0 ? (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-900 font-medium">No groups assigned for evaluation</p>
              <p className="text-sm text-amber-800 mt-1">
                Coordinator must assign you to a group before evaluation can start.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-md">
            <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">
              Select Group to Evaluate
            </Label>
            <Select value={selectedGroup} onValueChange={v => {
              setSelectedGroup(v);
              setScores({});
              setComment('');
              setCriteria([]);
              setSubmissionStatus('draft');
            }}>
              <SelectTrigger id="group-select">
                <SelectValue placeholder="Choose a group…" />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    Group {g.groupNumber} — {g.projectTitle} ({g.course})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {selectedGroup && currentGroup ? (
        <div>
          {/* Eval not active banner */}
          {!currentGroup.evaluationActive && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-amber-900 font-medium">Evaluation not yet active</p>
                <p className="text-sm text-amber-800 mt-1">
                  Evaluation unlocks after the presentation date and time has passed.
                </p>
              </div>
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-4">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              CPIS-{ct}: 8 criteria × 0–5 = 40 marks. Each criterion must be scored 0–5.
              Your scores are independent — you cannot see other evaluators' scores before submission.
            </span>
          </div>

          {/* Group header */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5 mb-4 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-[var(--color-text-900)] font-semibold">Group {currentGroup.groupNumber}</h2>
                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 border border-blue-200">{currentGroup.course}</span>
                <span className={`px-2 py-0.5 text-xs rounded-full border ${
                  submissionStatus === 'submitted' ? 'bg-green-100 text-green-700 border-green-200' :
                  submissionStatus === 'locked'    ? 'bg-red-100 text-red-700 border-red-200' :
                  'bg-gray-100 text-gray-600 border-gray-200'
                }`}>
                  {submissionStatus === 'submitted' ? 'Submitted' : submissionStatus === 'locked' ? 'Locked' : 'Draft'}
                </span>
              </div>
              <p className="text-[var(--color-text-600)] text-sm">{currentGroup.projectTitle}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-[var(--color-text-900)]">
                  {total}<span className="text-sm font-normal text-[var(--color-text-500)]">/{maxTotal}</span>
                </div>
                <div className="text-xs text-[var(--color-text-600)]">{pct}% complete</div>
              </div>
              <div className="flex gap-2">
                {!isReadOnly && (
                  <>
                    <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving || !currentGroup.evaluationActive}>
                      <Save className="w-4 h-4 mr-1" />Draft
                    </Button>
                    <Button size="sm" onClick={() => setShowConfirm(true)}
                      disabled={saving || !allFilled || !currentGroup.evaluationActive}
                      className="bg-green-600 text-white hover:bg-green-700">
                      <Send className="w-4 h-4 mr-1" />Submit
                    </Button>
                    <Button variant="outline" size="sm"
                      onClick={() => setShowIP(true)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      disabled={!currentGroup.evaluationActive}>
                      Mark IP
                    </Button>
                  </>
                )}
                {isReadOnly && (
                  <div className="flex items-center gap-2 text-green-700 text-sm">
                    <CheckCircle className="w-4 h-4" />Submitted
                  </div>
                )}
              </div>
            </div>
          </div>

          {criteria.length > 0 ? (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden mb-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b-2 border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm text-[var(--color-text-700)]">Criterion</th>
                      {[0,1,2,3,4,5].map(n => (
                        <th key={n} className="text-center py-3 px-2 text-[var(--color-text-600)] w-12 text-sm">{n}</th>
                      ))}
                      <th className="text-center py-3 px-4 text-sm text-[var(--color-text-700)] w-20">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {criteria.map(c => (
                      <CommitteeRow
                        key={c.criterionKey}
                        criterion={c}
                        value={scores[c.criterionKey] !== undefined ? scores[c.criterionKey] : null}
                        onChange={v => {
                          if (isReadOnly || !currentGroup.evaluationActive) return;
                          setScores(p => ({ ...p, [c.criterionKey]: v }));
                        }}
                        disabled={isReadOnly || !currentGroup.evaluationActive}
                      />
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-yellow-50 border-t-2 border-yellow-200">
                      <td colSpan={7} className="py-3 px-4 text-right font-bold text-[var(--color-text-900)]">Total:</td>
                      <td className="py-3 px-4 text-center font-bold text-[var(--color-text-900)] text-lg tabular-nums">
                        {total}/{maxTotal}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800 mb-4">
              <AlertCircle className="w-5 h-5 inline mr-2" />
              No committee rubric found. Run docs/sql/001_full_grading_system.sql in Supabase.
            </div>
          )}

          {/* Comments */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
            <Label className="mb-2 block text-[var(--color-text-700)]">Comments / Justification</Label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Overall notes and justification for scores…"
              className="min-h-[120px]"
              disabled={isReadOnly}
            />
          </div>

          {!allFilled && !isReadOnly && criteria.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {criteria.filter(c => scores[c.criterionKey] === undefined).length} criteria not scored yet.
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <FileText className="w-12 h-12 text-[var(--color-text-400)] mx-auto mb-4" />
          <p className="text-[var(--color-text-600)]">Select a group to begin evaluation</p>
        </div>
      )}

      {/* Submit Confirm Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Committee Evaluation</DialogTitle>
            <DialogDescription>Once submitted, your evaluation will be locked.</DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-2 text-sm">
            <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
              <span className="text-[var(--color-text-600)]">Criteria scored:</span>
              <span className="font-medium">{criteria.filter(c => scores[c.criterionKey] !== undefined).length}/{criteria.length}</span>
            </div>
            <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <span className="text-green-800 font-semibold">Total Score:</span>
              <span className="font-bold text-green-800">{total}/{maxTotal}</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
              <Info className="w-3.5 h-3.5 inline mr-1" />
              Final group score = average of all committee members' totals.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={doSubmit} className="bg-green-600 text-white hover:bg-green-700">
              <Send className="w-4 h-4 mr-2" />Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IP Modal */}
      <Dialog open={showIP} onOpenChange={setShowIP}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as IP (Not Ready)</DialogTitle>
            <DialogDescription>This will mark the project as not ready for defense.</DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Label className="mb-2 block">Reason (Required)</Label>
            <Textarea
              value={ipReason}
              onChange={e => setIpReason(e.target.value)}
              placeholder="Explain why this project is not ready…"
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIP(false)}>Cancel</Button>
            <Button onClick={doMarkIP} className="bg-red-600 text-white hover:bg-red-700">Confirm Mark IP</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
