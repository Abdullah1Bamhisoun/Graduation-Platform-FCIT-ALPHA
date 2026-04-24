/**
 * Supervisor Grading Assessment
 *
 * Uses the official rubric with Likert scale (1–5) per criterion.
 * CPIS-498: 4 criteria → raw 4–20 → normalized to 18 marks
 * CPIS-499: 10 criteria → raw 10–50 → normalized to 23 marks
 *
 * Workflow: Draft → Submit → Locked (admin can unlock)
 */

import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import { useAuth } from '../../lib/AuthContext';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import { getAllGroupGrades } from '../../services/grades';
import {
  getRubricCriteria,
  getGradingComponents,
  getSupervisorRubricScores,
  type RubricCriterion,
  type GradingComponent,
} from '../../services/grading-rubric';
import { supabase } from '../../lib/supabase';
import { apiUrl, apiFetch } from '@/lib/api';
import { Save, Send, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import type { GroupGrade } from '../../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

// ─── Likert Scale Row ─────────────────────────────────────────────────────────

interface LikertRowProps {
  criterion: RubricCriterion;
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}

function LikertRow({ criterion, value, onChange, disabled }: LikertRowProps) {
  const descriptions: Record<number, string | undefined> = {
    1: criterion.description1,
    2: criterion.description2,
    3: criterion.description3,
    4: criterion.description4,
    5: criterion.description5,
  };

  return (
    <div className="border border-[var(--color-border)] rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <h4 className="font-semibold text-[var(--color-text-900)] text-sm">{criterion.criterionName}</h4>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold tabular-nums flex-shrink-0 ${
          value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {value ? `${value}/5` : 'Not scored'}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map(score => {
          const desc = descriptions[score];
          const selected = value === score;
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(score)}
              className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 text-xs transition-all ${
                selected
                  ? 'border-green-500 bg-green-50 text-green-800'
                  : 'border-[var(--color-border)] bg-white text-[var(--color-text-600)] hover:border-green-300 hover:bg-green-50/30'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                selected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {score}
              </span>
              {desc && (
                <span className="text-center leading-tight line-clamp-3" style={{ fontSize: '10px' }}>
                  {desc}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SupervisorGradingAssessment() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('grades');

  const [grades, setGrades]               = useState<GroupGrade[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [loading, setLoading]             = useState(true);
  const [saving, setSaving]               = useState(false);

  const [studentScores, setStudentScores]     = useState<Record<string, Record<string, number>>>({});
  const [studentComments, setStudentComments] = useState<Record<string, string>>({});
  const [submissionStatus, setSubmissionStatus] = useState<Record<string, 'draft' | 'submitted' | 'locked'>>({});

  const [criteria, setCriteria]   = useState<RubricCriterion[]>([]);
  const [component, setComponent] = useState<GradingComponent | null>(null);

  const [showConfirm, setShowConfirm]           = useState(false);
  const [confirmStudentId, setConfirmStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getAllGroupGrades()
      .then(g => setGrades(g.filter(gr => gr.supervisorName === user.name)))
      .finally(() => setLoading(false));
  }, [user]);

  const loadGroupData = useCallback(async (groupId: string) => {
    const group = grades.find(g => g.groupId === groupId);
    if (!group) return;
    const ct = courseTypeFromCode(group.course);
    // Use the group's actual course_id directly to avoid fuzzy-match returning wrong course
    const { data: gRow } = await supabase.from('groups').select('course_id').eq('id', groupId).single();
    const courseId = gRow?.course_id ?? null;
    if (!courseId) return;

    const [crit, comps] = await Promise.all([
      getRubricCriteria(ct, 'supervisor_eval'),
      getGradingComponents(ct),
    ]);
    setCriteria(crit);
    setComponent(comps.find(c => c.componentKey === 'supervisor_eval') ?? null);

    const scores: Record<string, Record<string, number>> = {};
    const comments: Record<string, string> = {};
    const statuses: Record<string, 'draft' | 'submitted' | 'locked'> = {};

    for (const student of group.students) {
      const existing = await getSupervisorRubricScores(student.id, groupId, courseId);
      scores[student.id] = {};
      for (const s of existing) scores[student.id][s.criterionKey] = s.rawScore;

      const { data: assess } = await supabase
        .from('supervisor_assessments')
        .select('comment')
        .eq('student_id', student.id)
        .eq('group_id', groupId)
        .eq('course_id', courseId)
        .maybeSingle();
      comments[student.id] = assess?.comment ?? '';
      // submission_status lives in supervisor_rubric_scores, not supervisor_assessments
      statuses[student.id] = existing[0]?.submissionStatus ?? 'draft';
    }

    setStudentScores(scores);
    setStudentComments(comments);
    setSubmissionStatus(statuses);
  }, [grades]);

  useEffect(() => {
    if (!selectedGroup) return;
    loadGroupData(selectedGroup);
  }, [selectedGroup, loadGroupData]);

  if (!user) return null;
  if (loading) {
    return (
      <Layout user={user} pageTitle="Supervisor Assessment">
        <div className="p-6 text-[var(--color-text-600)]">Loading…</div>
      </Layout>
    );
  }

  const selectedGrade = grades.find(g => g.groupId === selectedGroup);
  const ct            = selectedGrade ? courseTypeFromCode(selectedGrade.course) : null;
  const maxRaw        = criteria.reduce((s, c) => s + c.maxRawScore, 0);
  const totalMarks    = component?.totalMarks ?? (ct === '499' ? 23 : 18);

  const getStudentRawTotal = (studentId: string) =>
    criteria.reduce((s, c) => s + (studentScores[studentId]?.[c.criterionKey] ?? 0), 0);

  const getStudentNormalized = (studentId: string) => {
    const raw = getStudentRawTotal(studentId);
    if (!maxRaw) return 0;
    return Math.round((raw / maxRaw) * totalMarks * 100) / 100;
  };

  const allCriteriaFilled = (studentId: string) =>
    criteria.every(c => (studentScores[studentId]?.[c.criterionKey] ?? 0) > 0);

  const saveDraft = async (studentId: string) => {
    if (!selectedGrade || !user) return;
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token ?? '';
      const res = await apiFetch(apiUrl(`/api/groups/${selectedGroup}/supervisor-evaluation`), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          evaluations:      [{ studentId, scores: studentScores[studentId] ?? {}, comment: studentComments[studentId] || null }],
          submissionStatus: 'draft',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Failed to save draft');
      }
      setSubmissionStatus(p => ({ ...p, [studentId]: 'draft' }));
      toast.success('Draft saved.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const confirmSubmit = (studentId: string) => {
    if (!allCriteriaFilled(studentId)) {
      toast.error('Please score all criteria before submitting.');
      return;
    }
    setConfirmStudentId(studentId);
    setShowConfirm(true);
  };

  const doSubmit = async () => {
    const studentId = confirmStudentId;
    if (!studentId || !selectedGrade || !user) return;
    setShowConfirm(false);
    setSaving(true);
    try {
      const session = await supabase.auth.getSession();
      const token   = session.data.session?.access_token ?? '';
      const res = await apiFetch(apiUrl(`/api/groups/${selectedGroup}/supervisor-evaluation`), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          evaluations:      [{ studentId, scores: studentScores[studentId] ?? {}, comment: studentComments[studentId] || null }],
          submissionStatus: 'submitted',
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error || 'Failed to submit');
      }
      const result = await res.json();
      const normalized = result.results?.find((r: any) => r.studentId === studentId)?.normalizedScore
        ?? getStudentNormalized(studentId);
      setSubmissionStatus(p => ({ ...p, [studentId]: 'submitted' }));
      toast.success(`Submitted. Normalized score: ${normalized}/${totalMarks}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout user={user} pageTitle="Supervisor Assessment">
      {isLocked && <LockedBanner />}

      <div className="mb-6">
        <p className="text-[var(--color-text-600)] mb-4">
          Grade each student using the official rubric. Scores 1–5 per criterion are normalized to
          the component's total marks automatically.
        </p>

        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 mb-4">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {ct === '499'
              ? 'CPIS-499: 10 criteria × scale 1–5 (raw max 50) → normalized to 23 marks'
              : ct === '498'
              ? 'CPIS-498: 4 criteria × scale 1–5 (raw max 20) → normalized to 18 marks'
              : 'Select a group to see the rubric criteria.'}
          </span>
        </div>

        <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
        <Select value={selectedGroup} onValueChange={v => {
          setSelectedGroup(v);
          setStudentScores({});
          setStudentComments({});
          setSubmissionStatus({});
          setCriteria([]);
          setComponent(null);
        }}>
          <SelectTrigger id="group-select" className="max-w-md">
            <SelectValue placeholder="Choose a group to grade" />
          </SelectTrigger>
          <SelectContent>
            {grades.map(group => (
              <SelectItem key={group.groupId} value={group.groupId}>
                {group.groupName} — {group.course}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedGrade && criteria.length > 0 ? (
        <div className="space-y-8">
          {selectedGrade.students.map(student => {
            const rawTotal   = getStudentRawTotal(student.id);
            const normalized = getStudentNormalized(student.id);
            const allFilled  = allCriteriaFilled(student.id);
            const status     = submissionStatus[student.id] ?? 'draft';
            // Only hard-lock when admin-locked or coordinator-locked.
            // 'submitted' state still allows editing — supervisor can re-submit to update scores.
            const isReadOnly = status === 'locked' || isLocked;

            return (
              <div key={student.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
                <div className="p-5 border-b border-[var(--color-border)] bg-[var(--color-surface-alt)] flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-[var(--color-text-900)]">{student.name}</h3>
                    <p className="text-sm text-[var(--color-text-600)] mt-0.5">{selectedGrade.course} · {selectedGrade.groupName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xl font-bold tabular-nums text-[var(--color-text-900)]">
                        {rawTotal}<span className="text-sm font-normal text-[var(--color-text-600)]">/{maxRaw} raw</span>
                      </div>
                      <div className="text-sm text-green-700 font-semibold tabular-nums">
                        → {normalized}/{totalMarks} normalized
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                      status === 'locked'    ? 'bg-red-50 text-red-700 border-red-200' :
                      status === 'submitted' ? 'bg-green-50 text-green-700 border-green-200' :
                                              'bg-yellow-50 text-yellow-700 border-yellow-200'
                    }`}>
                      {status === 'locked' ? 'Locked' : status === 'submitted' ? 'Submitted' : 'Draft'}
                    </span>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  {criteria.map(c => (
                    <LikertRow
                      key={c.criterionKey}
                      criterion={c}
                      value={studentScores[student.id]?.[c.criterionKey] ?? null}
                      onChange={score => {
                        if (isReadOnly) return;
                        setStudentScores(prev => ({
                          ...prev,
                          [student.id]: { ...prev[student.id], [c.criterionKey]: score },
                        }));
                      }}
                      disabled={isReadOnly}
                    />
                  ))}

                  <div className="pt-2">
                    <Label className="text-sm mb-1 block text-[var(--color-text-700)]">Comments</Label>
                    <Textarea
                      value={studentComments[student.id] ?? ''}
                      onChange={e => setStudentComments(p => ({ ...p, [student.id]: e.target.value }))}
                      placeholder="Enter assessment comments…"
                      className="min-h-[80px] text-sm"
                      disabled={isReadOnly}
                    />
                  </div>

                  {!allFilled && !isReadOnly && (
                    <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {criteria.filter(c => !(studentScores[student.id]?.[c.criterionKey])).length} criteria not scored yet.
                    </div>
                  )}

                  {!isReadOnly && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-border)]">
                      <Button variant="outline" size="sm" onClick={() => saveDraft(student.id)} disabled={saving}>
                        <Save className="w-4 h-4 mr-2" />Save Draft
                      </Button>
                      <Button size="sm" onClick={() => confirmSubmit(student.id)}
                        disabled={saving || !allFilled}
                        className="bg-green-600 text-white hover:bg-green-700">
                        <Send className="w-4 h-4 mr-2" />{status === 'submitted' ? 'Re-submit' : 'Submit'}
                      </Button>
                    </div>
                  )}

                  {status === 'submitted' && !isReadOnly && (
                    <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Assessment submitted. You can still edit and re-submit.
                    </div>
                  )}

                  {status === 'locked' && (
                    <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Assessment locked. Contact admin to unlock if needed.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : selectedGroup && criteria.length === 0 ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-sm text-amber-800">
          <AlertCircle className="w-5 h-5 inline mr-2" />
          No rubric criteria found. Please run the SQL migration: docs/sql/001_full_grading_system.sql
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-[var(--color-text-600)]">Select a group to begin assessment</p>
        </div>
      )}

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Assessment</DialogTitle>
            <DialogDescription>Submit assessment scores. You can re-edit and re-submit until grades are locked by the coordinator.</DialogDescription>
          </DialogHeader>
          {confirmStudentId && selectedGrade && (
            <div className="py-3 space-y-2 text-sm">
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-[var(--color-text-600)]">Student:</span>
                <span className="font-medium">{selectedGrade.students.find(s => s.id === confirmStudentId)?.name}</span>
              </div>
              <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-[var(--color-text-600)]">Raw Score:</span>
                <span className="font-bold">{getStudentRawTotal(confirmStudentId)}/{maxRaw}</span>
              </div>
              <div className="flex justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-green-800 font-semibold">Normalized:</span>
                <span className="font-bold text-green-800">{getStudentNormalized(confirmStudentId)}/{totalMarks}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={doSubmit} className="bg-green-600 text-white hover:bg-green-700">
              <Send className="w-4 h-4 mr-2" />Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
