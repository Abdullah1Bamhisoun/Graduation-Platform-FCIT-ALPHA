import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '../../lib/api';
import { getWeekStatuses, getDisplayStatus } from '../../services/week-statuses';
import { getAllRubricCriteria } from '../../services/grading-rubric';
import { getStudentGrade } from '../../services/grades';
import type { RubricCriterion } from '../../services/grading-rubric';
import type { StudentGrade, WeekStatus } from '../../types';
import {
  CheckCircle,
  Info,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  Users,
  FileText,
  RefreshCw,
  MessageSquare,
  X,
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GradeComponentItem {
  componentKey: string;
  componentName: string;
  totalMarks: number;
  evaluatorRole: string;
  score: number | null;
  maxScore: number;
}

interface PrevCourseComment {
  comment: string;
  evaluatorName: string;
  evaluatedAt: string | null;
}

interface StudentMyGradesData {
  groupId: string;
  groupNumber: number;
  projectName: string;
  status: string;
  projectStatus: 'normal' | 'ip';
  ipMarkedAt: string | null;
  ipReason: string | null;
  courseCode: string;
  courseType: '498' | '499';
  supervisorName: string | null;
  students: { id: string; name: string }[];
  components: GradeComponentItem[];
  supervisorEvaluation: {
    score: number | null;
    maxScore: number;
    gradedAt: string | null;
    submissionStatus: string;
    comment?: string | null;
  } | null;
  committeeEvaluation: { score: number; maxScore: number; comment?: string | null } | null;
  coordinatorComment?: string | null;
  approvalCounts: { total: number; pending: number; approved: number; rejected: number };
  weeklyScore: number;
  weeklyMaxScore: number;
  weeklyTotalRaw: number;
  weeksOpened: number;
  weeklyIsAtCap: boolean;
  weeklyBreakdown: { weekNumber: number; studentMark: number; supervisorMark: number }[];
  peerEvaluation: {
    receivedCount: number;
    averageRaw: number | null;
    convertedScore: number | null;
    componentWeight: number;
    hasSubmitted: boolean;
  };
  deliverables: Record<string, { score: number | null; maxScore: number; gradedAt: string | null }> | null;
  deliverablesTotal: number;
  totalScore: number;
  finalGrade: string;
  prevCourseComments?: PrevCourseComment[] | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchMyGrades(_studentId: string): Promise<StudentMyGradesData | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token ?? '';

  const res = await fetch(apiUrl('/api/students/my-grades'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function getScoreColor(score: number, max: number) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 60) return 'text-orange-600';
  return 'text-red-600';
}

function gradeBadgeClass(grade: string) {
  if (['A+', 'A'].includes(grade)) return 'bg-green-100 text-green-800 border-green-300';
  if (['B+', 'B'].includes(grade)) return 'bg-blue-100 text-blue-800 border-blue-300';
  if (['C+', 'C'].includes(grade)) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (['D+', 'D'].includes(grade)) return 'bg-orange-100 text-orange-800 border-orange-300';
  if (grade === 'F') return 'bg-red-100 text-red-800 border-red-300';
  return 'bg-gray-100 text-gray-600 border-gray-300';
}

const WEEK_STATUS_STYLES: Record<string, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-200',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-200',
  'Locked':     'bg-red-100 text-red-700 border-red-200',
  'Not Opened': 'bg-slate-100 text-slate-500 border-slate-200',
};

const DELIVERABLE_LABELS: Record<string, string> = {
  chapter1:           'Chapter 1 — Project Outlines',
  chapter2:           'Chapter 2 — Literature Review',
  chapter3:           'Chapter 3 — Analysis',
  chapter4:           'Chapter 4 — System Design',
  finalReport:        'Final Report',
  revisedFinalReport: 'Revised Final Report',
  presentation:       'Presentation',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function StudentGradesOverview() {
  const { user } = useAuth();
  const [gradesData, setGradesData]         = useState<StudentMyGradesData | null | 'loading'>('loading');
  const [weekStatuses, setWeekStatuses]     = useState<WeekStatus[]>([]);
  const [delivExpanded, setDelivExpanded]   = useState(false);
  const [cpis498Expanded, setCpis498Expanded] = useState(false);
  const [cpis499Expanded, setCpis499Expanded] = useState(false);
  const [peerRatings, setPeerRatings]       = useState<Record<string, number>>({});
  const [peerSubmitting, setPeerSubmitting] = useState(false);
  const [peerSubmitError, setPeerSubmitError] = useState<string | null>(null);
  const [peerSubmitted, setPeerSubmitted]   = useState(false);
  const [peerEditing, setPeerEditing]       = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({});
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  // Student marks dialog (click group member name)
  const [memberDialogOpen, setMemberDialogOpen]   = useState(false);
  const [memberDialogLoading, setMemberDialogLoading] = useState(false);
  const [memberDialogData, setMemberDialogData]   = useState<StudentGrade | null>(null);
  const [memberDialogName, setMemberDialogName]   = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const grades = await fetchMyGrades(user.id);
      setGradesData(grades);

      if (grades) {
        const [ws, criteria] = await Promise.all([
          getWeekStatuses(grades.courseType, 'DEFAULT'),
          getAllRubricCriteria(grades.courseType),
        ]);
        setWeekStatuses(ws);
        setRubricCriteria(criteria);

        // Seed criterion scores from the API response first (no RLS dependency).
        // coordinator_deliverable keys (demo, poster_day, chapter_implementation, etc.)
        // come from grades.deliverables which is already fetched server-side.
        const scores: Record<string, number> = {};
        for (const [key, d] of Object.entries(grades.deliverables ?? {})) {
          if (d.score != null) scores[key] = d.score;
        }
        setCriterionScores(scores);

        // Fetch supervisor + committee rubric scores (need course_id from courses table).
        // If this query is blocked or returns nothing, the coordinator deliverable
        // scores set above are still shown correctly.
        const { data: courseRow } = await supabase
          .from('courses')
          .select('id')
          .eq('code', grades.courseCode)
          .limit(1)
          .maybeSingle();

        if (courseRow) {
          const [{ data: supScores }, { data: commScores }] = await Promise.all([
            supabase
              .from('supervisor_rubric_scores')
              .select('criterion_key, raw_score')
              .eq('student_id', user.id)
              .eq('group_id', grades.groupId)
              .eq('course_id', courseRow.id),
            supabase
              .from('committee_rubric_scores')
              .select('criterion_key, score')
              .eq('group_id', grades.groupId)
              .eq('course_id', courseRow.id)
              .in('submission_status', ['submitted', 'locked']),
          ]);

          for (const s of supScores ?? []) {
            scores[s.criterion_key] = Number(s.raw_score);
          }
          const commSums: Record<string, number[]> = {};
          for (const s of commScores ?? []) {
            (commSums[s.criterion_key] ??= []).push(Number(s.score));
          }
          for (const [key, vals] of Object.entries(commSums)) {
            if (!(key in scores)) {
              scores[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
          }
          // Re-apply deliverable scores so they're never overwritten by empty rubric data
          for (const [key, d] of Object.entries(grades.deliverables ?? {})) {
            if (d.score != null) scores[key] = d.score;
          }
          setCriterionScores({ ...scores });
        }
      }
    } catch (err) {
      console.error('Failed to load grades:', err);
      setGradesData(null);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggleCriterion(key: string) {
    setExpandedCriteria((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleComponent(key: string) {
    setExpandedComponents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handlePeerSubmit() {
    if (!user || gradesData === 'loading' || !gradesData) return;
    const g = gradesData;
    const peers = g.students.filter((s) => s.id !== user.id);
    if (peers.some((s) => !peerRatings[s.id])) {
      setPeerSubmitError('Please rate all group members before submitting.');
      return;
    }
    setPeerSubmitting(true);
    setPeerSubmitError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? '';

      // Build ratings map: { [studentId]: score }
      const ratings: Record<string, number> = {};
      for (const peer of peers) {
        ratings[peer.id] = Number(peerRatings[peer.id]);
      }

      const res = await fetch(apiUrl('/api/students/peer-evaluations'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ratings }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      setPeerSubmitted(true);
      setPeerEditing(false);
    } catch (err: any) {
      console.error('Peer evaluation submit error:', err);
      setPeerSubmitError(err?.message ?? 'Failed to submit. Please try again.');
    } finally {
      setPeerSubmitting(false);
    }
  }

  async function handlePeerEdit() {
    if (!user || gradesData === 'loading' || !gradesData) return;
    const g = gradesData;
    // Load existing ratings so the form is pre-filled
    const { data: existing } = await supabase
      .from('peer_evaluations')
      .select('student_id, score')
      .eq('evaluator_id', user.id)
      .eq('group_id', g.groupId);
    const loaded: Record<string, number> = {};
    for (const row of existing ?? []) loaded[row.student_id] = row.score;
    setPeerRatings(loaded);
    setPeerSubmitError(null);
    setPeerEditing(true);
  }

  async function openMemberDetail(studentId: string, studentName: string, courseCode: string) {
    setMemberDialogName(studentName);
    setMemberDialogData(null);
    setMemberDialogOpen(true);
    setMemberDialogLoading(true);
    try {
      const grade = await getStudentGrade(studentId, courseCode);
      setMemberDialogData(grade);
    } catch {
      setMemberDialogData(null);
    } finally {
      setMemberDialogLoading(false);
    }
  }

  if (!user) return null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (gradesData === 'loading') {
    return (
      <Layout user={user} pageTitle="My Grades">
        <div className="p-6 text-[var(--color-text-600)]">Loading grades…</div>
      </Layout>
    );
  }

  // ── No group assigned ────────────────────────────────────────────────────
  if (!gradesData) {
    return (
      <Layout user={user} pageTitle="My Grades">
        <div className="flex items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 text-sm">
            You are not assigned to a group yet. Grades will appear once your supervisor assigns you.
          </p>
        </div>
      </Layout>
    );
  }

  const g   = gradesData;
  const isIP = g.projectStatus === 'ip';
  const is498Fail = g.courseType === '498' && g.totalScore > 0 && g.totalScore < 60;

  // Build week mark map for O(1) lookup in the weekly table
  const weekMarkMap: Record<number, { studentMark: number; supervisorMark: number }> = {};
  for (const w of g.weeklyBreakdown) {
    weekMarkMap[w.weekNumber] = { studentMark: w.studentMark, supervisorMark: w.supervisorMark };
  }

  return (
    <Layout user={user} pageTitle={`My Grades — ${g.courseCode}`}>

      {/* ── Refresh button ──────────────────────────────────────────────────── */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-600)] border border-[var(--color-border)] bg-[var(--color-surface-white)] hover:bg-[var(--color-surface-alt)] disabled:opacity-50 rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh grades'}
        </button>
      </div>

      {/* ── IP Banner ──────────────────────────────────────────────────────── */}
      {isIP && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-orange-300 bg-orange-50 p-4">
          <AlertTriangle className="mt-0.5 w-5 h-5 text-orange-500 flex-shrink-0" />
          <div>
            <p className="text-orange-800 text-sm font-semibold">
              Your project is marked as In Progress (IP)
            </p>
            {g.ipReason && (
              <p className="text-orange-700 text-sm mt-0.5">Reason: {g.ipReason}</p>
            )}
            {g.ipMarkedAt && (
              <p className="text-orange-600 text-xs mt-0.5">
                Marked on {new Date(g.ipMarkedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Group Header Card ───────────────────────────────────────────────── */}
      <div className="mb-5 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border border-[var(--color-primary-200)] px-2 py-0.5 rounded-full">
                Group {g.groupNumber}
              </span>
              {isIP && (
                <span className="text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300 px-2 py-0.5 rounded-full">
                  IP
                </span>
              )}
            </div>
            <h2 className="text-[var(--color-text-900)] font-semibold text-lg">{g.projectName}</h2>
            <p className="text-[var(--color-text-600)] text-sm mt-0.5">
              {g.courseCode}
              {g.supervisorName && (
                <> &middot; Supervisor: <span className="font-medium">{g.supervisorName}</span></>
              )}
            </p>
            {/* Group members with "you" highlight — click to see marks */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {g.students.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openMemberDetail(s.id, s.name, g.courseCode)}
                  className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                    s.id === user.id
                      ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)] font-semibold hover:bg-(--color-primary-200)'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-600)] border-[var(--color-border)] hover:bg-(--color-border)'
                  }`}
                >
                  {s.name}{s.id === user.id ? ' (you)' : ''}
                </button>
              ))}
            </div>
          </div>

          {/* Score + Grade badge */}
          <div className="sm:text-right flex-shrink-0 flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0">
            <div className={`text-4xl font-bold tabular-nums ${getScoreColor(g.totalScore, 100)}`}>
              {g.totalScore.toFixed(1)}
            </div>
            <div className="text-[var(--color-text-600)] text-sm">/ 100</div>
            <div className={`mt-1 text-sm font-bold px-2 py-0.5 rounded-full border inline-block ${gradeBadgeClass(g.finalGrade)}`}>
              {g.finalGrade}
            </div>
            {is498Fail && (
              <p className="text-xs text-red-600 mt-1 font-medium">Below passing threshold (60)</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Grade Components Accordion ──────────────────────────────────────── */}
      <div className="mb-5 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <h3 className="text-[var(--color-text-900)] font-semibold">Grade Components</h3>
          <p className="text-xs text-[var(--color-text-600)] mt-0.5">
            Grading scheme defined by the Coordinator · click a component to see its criteria
          </p>
        </div>

        {/* Accordion rows */}
        <div className="divide-y divide-[var(--color-border)]">
          {g.components.map((c) => {
            const isExpanded   = expandedComponents.has(c.componentKey);
            const criteria     = rubricCriteria.filter((rc) => rc.componentKey === c.componentKey);
            const hasCriteria  = criteria.length > 0;
            const isWeekly     = c.componentKey === 'progress_reports';
            const isExpandable = hasCriteria || isWeekly;
            const pct = c.maxScore > 0 && c.score != null
              ? Math.min((c.score / c.maxScore) * 100, 100)
              : 0;
            const barColor =
              pct >= 90 ? 'bg-green-500' :
              pct >= 75 ? 'bg-blue-500'  :
              pct >= 60 ? 'bg-yellow-500' : 'bg-red-400';

            return (
              <div key={c.componentKey}>
                {/* ── Collapsed header ── */}
                <button
                  type="button"
                  onClick={() => isExpandable && toggleComponent(c.componentKey)}
                  className={`w-full px-5 py-4 flex items-center gap-4 text-left transition-colors ${
                    isExpandable
                      ? 'hover:bg-[var(--color-surface-alt)]/60 cursor-pointer'
                      : 'cursor-default'
                  }`}
                >
                  {/* Component name */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-900)]">
                      {c.componentKey === 'progress_reports' ? 'Weekly Reports' : c.componentName}
                    </span>
                    {isExpandable && (
                      <span className="text-xs text-[var(--color-text-500)] border border-[var(--color-border)] bg-[var(--color-surface-alt)] rounded-full px-2 py-0.5 leading-none">
                        {isWeekly ? 'breakdown' : 'criteria'}
                      </span>
                    )}
                  </div>

                  {/* Score + progress */}
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                    <span
                      className={`text-sm font-mono font-semibold tabular-nums ${
                        c.score != null ? getScoreColor(c.score, c.maxScore) : 'text-[var(--color-text-500)]'
                      }`}
                    >
                      {c.score != null ? c.score.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-[var(--color-text-500)]">/{c.maxScore}</span>
                    <div className="w-16 sm:w-20 bg-gray-200 rounded-full h-1.5 hidden sm:block">
                      <div
                        className={`${barColor} h-1.5 rounded-full transition-all`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Chevron — only when expandable */}
                  {isExpandable && (
                    isExpanded
                      ? <ChevronUp className="w-4 h-4 text-[var(--color-text-500)] flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-[var(--color-text-500)] flex-shrink-0" />
                  )}
                </button>

                {/* ── Expanded panel ── */}
                {isExpanded && isExpandable && (
                  <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-alt)]/40">

                    {/* Weekly breakdown */}
                    {isWeekly && (
                      <>
                        <div className="px-5 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-600)] flex items-center gap-2">
                          <Info className="w-3.5 h-3.5 flex-shrink-0" />
                          Each open week = 2 marks (1 submission + 1 supervisor response). Maximum:{' '}
                          <strong className="ml-1">{g.weeklyMaxScore} marks</strong>.
                          {g.weeklyIsAtCap && (
                            <span className="ml-1 font-semibold text-green-700">Cap reached — no further marks added.</span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-[var(--color-surface-alt)]">
                              <tr>
                                <th className="p-3 text-left text-[var(--color-text-700)] font-medium">Week</th>
                                <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Status</th>
                                <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Submission</th>
                                <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Supervisor</th>
                                <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Week Total</th>
                                <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Running</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[var(--color-border)]">
                              {(() => {
                                let running = 0;
                                return Array.from({ length: 16 }, (_, i) => i + 1).map((wn) => {
                                  const ws            = weekStatuses.find((s) => s.weekNumber === wn);
                                  const displayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                                  const wasOpened     = ws?.wasOpened ?? false;
                                  const marks         = weekMarkMap[wn];
                                  const studentMark   = wasOpened ? (marks?.studentMark    ?? 0) : null;
                                  const supMark       = wasOpened ? (marks?.supervisorMark ?? 0) : null;
                                  const weekTotal     = wasOpened ? ((studentMark ?? 0) + (supMark ?? 0)) : null;

                                  if (wasOpened && weekTotal !== null) running += weekTotal;
                                  const cappedRunning  = Math.min(running, g.weeklyMaxScore);
                                  const capHitThisWeek =
                                    wasOpened &&
                                    running > g.weeklyMaxScore &&
                                    running - (weekTotal ?? 0) < g.weeklyMaxScore;

                                  const statusClass = WEEK_STATUS_STYLES[displayStatus] ?? WEEK_STATUS_STYLES['Not Opened'];

                                  return (
                                    <tr
                                      key={wn}
                                      className={!wasOpened ? 'opacity-50' : capHitThisWeek ? 'bg-green-50' : ''}
                                    >
                                      <td className="p-3 text-[var(--color-text-900)]">
                                        Week {wn}
                                        {capHitThisWeek && (
                                          <span className="ml-2 text-xs text-green-600 font-medium">(cap reached)</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusClass}`}>
                                          {displayStatus === 'Locked' && <Lock className="w-3 h-3" />}
                                          {displayStatus}
                                        </span>
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        {studentMark !== null ? (
                                          <span className={studentMark === 1 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                                            {studentMark}/1
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        {supMark !== null ? (
                                          <span className={supMark === 1 ? 'text-blue-600 font-semibold' : 'text-gray-400'}>
                                            {supMark}/1
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono text-[var(--color-text-600)]">
                                        {weekTotal !== null ? (
                                          <span className={weekTotal === 2 ? 'text-green-700 font-semibold' : ''}>
                                            {weekTotal}/2
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                      <td className="p-3 text-center font-mono">
                                        {wasOpened ? (
                                          <span className={cappedRunning >= g.weeklyMaxScore ? 'text-green-700 font-bold' : 'text-[var(--color-text-700)]'}>
                                            {cappedRunning}/{g.weeklyMaxScore}
                                            {cappedRunning >= g.weeklyMaxScore ? ' ✓' : ''}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-gray-400">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                          {g.weeksOpened === 0 && (
                            <div className="p-5 text-center text-[var(--color-text-600)] text-sm">
                              No weekly sessions have been activated yet.
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {/* Rubric criteria */}
                    {hasCriteria && !isWeekly && (
                      <div className="px-5 py-4 space-y-2">
                        {criteria.map((criterion) => {
                          const isCriterionExpanded = expandedCriteria.has(criterion.criterionKey);
                          const rawScore = criterionScores[criterion.criterionKey];
                          const hasScore = rawScore != null;
                          const levels = [
                            { score: 1, label: 'Unsatisfactory', desc: criterion.description1 },
                            { score: 2, label: 'Poor',           desc: criterion.description2 },
                            { score: 3, label: 'Acceptable',     desc: criterion.description3 },
                            { score: 4, label: 'Good',           desc: criterion.description4 },
                            { score: 5, label: 'Excellent',      desc: criterion.description5 },
                          ].filter((l) => l.desc);

                          return (
                            <div key={criterion.criterionKey} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)] overflow-hidden">
                              {/* Criterion header — always visible */}
                              {c.componentKey === 'coordinator_deliverables' ? (
                                <div className="flex items-center px-3 py-2.5">
                                  <span className="text-xs font-semibold text-[var(--color-text-800)] min-w-0">
                                    {criterion.criterionName}
                                    <span className="ml-1.5 font-mono text-[var(--color-text-500)]">
                                      — {hasScore ? `${rawScore % 1 === 0 ? rawScore : rawScore.toFixed(1)} / ${criterion.maxRawScore}` : `/ ${criterion.maxRawScore}`}
                                    </span>
                                  </span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleCriterion(criterion.criterionKey)}
                                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-[var(--color-surface-alt)]/60 transition-colors text-left"
                                >
                                  <span className="text-xs font-semibold text-[var(--color-text-800)] min-w-0">
                                    {criterion.criterionName}
                                    <span className="ml-1.5 font-mono text-[var(--color-text-500)]">
                                      — {hasScore ? `${rawScore % 1 === 0 ? rawScore : rawScore.toFixed(1)} / ${criterion.maxRawScore}` : `/ ${criterion.maxRawScore}`}
                                    </span>
                                  </span>
                                  {isCriterionExpanded
                                    ? <ChevronUp className="w-3.5 h-3.5 text-[var(--color-text-500)] flex-shrink-0" />
                                    : <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-500)] flex-shrink-0" />}
                                </button>
                              )}

                              {/* Criterion level descriptions */}
                              {isCriterionExpanded && c.componentKey !== 'coordinator_deliverables' && (
                                <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
                                  {levels.map((level) => {
                                    const isCurrentLevel = hasScore && Math.round(rawScore) === level.score;
                                    return (
                                      <div
                                        key={level.score}
                                        className={`flex gap-3 px-3 py-2 ${
                                          isCurrentLevel
                                            ? 'bg-[var(--color-primary-50)] border-l-2 border-[var(--color-primary-500)]'
                                            : ''
                                        }`}
                                      >
                                        <span className={`text-xs font-bold flex-shrink-0 min-w-[6rem] sm:w-32 ${isCurrentLevel ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-700)]'}`}>
                                          {level.score}. {level.label}
                                          {isCurrentLevel && (
                                            <span className="block sm:inline ml-0 sm:ml-1 text-[10px] font-semibold text-[var(--color-primary-600)]">← your grade</span>
                                          )}
                                        </span>
                                        <span className={`text-xs leading-relaxed ${isCurrentLevel ? 'text-[var(--color-primary-800)]' : 'text-[var(--color-text-600)]'}`}>
                                          {level.desc}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Total row */}
          <div className="px-5 py-3 bg-[var(--color-surface-alt)] flex items-center justify-between rounded-b-xl">
            <span className="text-sm font-semibold text-[var(--color-text-900)]">Total</span>
            <div className="flex items-center gap-2">
              <span className={`text-lg font-bold font-mono tabular-nums ${getScoreColor(g.totalScore, 100)}`}>
                {g.totalScore.toFixed(1)}
              </span>
              <span className="text-sm text-[var(--color-text-600)]">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Feedback Sections (CPIS-498 + CPIS-499) ────────────────────────── */}
      <div className="mb-5 space-y-3">

        {/* CPIS-498 Feedback — only shown for students in CPIS-499 */}
        {g.courseType === '499' && (
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
            <button
              type="button"
              onClick={() => setCpis498Expanded(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-alt)] transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                <span className="font-semibold text-[var(--color-text-900)]">CPIS-498 Feedback</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Read-only</span>
                {g.prevCourseComments && g.prevCourseComments.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 border border-purple-200">
                    {g.prevCourseComments.length} comment{g.prevCourseComments.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              {cpis498Expanded
                ? <ChevronUp className="w-4 h-4 text-[var(--color-text-500)]" />
                : <ChevronDown className="w-4 h-4 text-[var(--color-text-500)]" />}
            </button>

            {cpis498Expanded && (
              <div className="border-t border-[var(--color-border)] p-5">
                {!g.prevCourseComments || g.prevCourseComments.length === 0 ? (
                  <p className="text-sm text-[var(--color-text-600)] italic">
                    No CPIS-498 committee feedback found.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-[var(--color-text-600)] mb-3">
                      Previous committee feedback from CPIS-498
                    </p>
                    {g.prevCourseComments.map((fb, idx) => (
                      <div key={idx} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-purple-800">{fb.evaluatorName}</span>
                          {fb.evaluatedAt && (
                            <span className="text-xs text-purple-600">
                              {new Date(fb.evaluatedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-purple-900 leading-relaxed">{fb.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* CPIS-499 (or current course) Feedback */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] overflow-hidden">
          <button
            type="button"
            onClick={() => setCpis499Expanded(v => !v)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-alt)] transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <span className="font-semibold text-[var(--color-text-900)]">{g.courseCode} Feedback</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">Read-only</span>
            </div>
            {cpis499Expanded
              ? <ChevronUp className="w-4 h-4 text-[var(--color-text-500)]" />
              : <ChevronDown className="w-4 h-4 text-[var(--color-text-500)]" />}
          </button>

          {cpis499Expanded && (
            <div className="border-t border-[var(--color-border)] p-5">
              {/* 3-column comment cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Supervisor Comment */}
                <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-xs font-semibold text-[var(--color-text-700)] uppercase tracking-wide">
                      Supervisor Comment
                    </span>
                  </div>
                  {g.supervisorEvaluation?.submissionStatus !== 'draft' && g.supervisorEvaluation?.comment ? (
                    <p className="text-sm text-[var(--color-text-800)] leading-relaxed">
                      {g.supervisorEvaluation.comment}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-text-500)] italic">No comment added yet</p>
                  )}
                  {g.supervisorEvaluation?.gradedAt && (
                    <p className="text-xs text-[var(--color-text-500)] mt-2">
                      {new Date(g.supervisorEvaluation.gradedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Committee Comment */}
                <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-green-400" />
                    <span className="text-xs font-semibold text-[var(--color-text-700)] uppercase tracking-wide">
                      Committee Comment
                    </span>
                  </div>
                  {g.committeeEvaluation?.comment ? (
                    <p className="text-sm text-[var(--color-text-800)] leading-relaxed whitespace-pre-wrap">
                      {g.committeeEvaluation.comment}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-text-500)] italic">No comment added yet</p>
                  )}
                </div>

                {/* Coordinator Comment */}
                <div className="bg-[var(--color-surface-alt)] border border-[var(--color-border)] rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-xs font-semibold text-[var(--color-text-700)] uppercase tracking-wide">
                      Coordinator Comment
                    </span>
                  </div>
                  {g.coordinatorComment ? (
                    <p className="text-sm text-[var(--color-text-800)] leading-relaxed">
                      {g.coordinatorComment}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--color-text-500)] italic">No comment added yet</p>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter Submissions + Peer Evaluation row ───────────────────────── */}
      <div className="mb-5 grid grid-cols-1 md:grid-cols-2 gap-5">

        {/* Chapter Submissions */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-blue-500" />
            <h3 className="text-[var(--color-text-900)] font-semibold text-sm">Chapter Submissions</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-2 rounded-lg bg-[var(--color-surface-alt)]">
              <div className="text-2xl font-bold text-[var(--color-text-900)]">{g.approvalCounts.approved}</div>
              <div className="text-xs text-green-600 font-medium mt-0.5">Approved</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-[var(--color-surface-alt)]">
              <div className="text-2xl font-bold text-[var(--color-text-900)]">{g.approvalCounts.pending}</div>
              <div className="text-xs text-yellow-600 font-medium mt-0.5">Pending Review</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-[var(--color-surface-alt)]">
              <div className="text-2xl font-bold text-[var(--color-text-900)]">{g.approvalCounts.rejected}</div>
              <div className="text-xs text-red-600 font-medium mt-0.5">Changes Requested</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-[var(--color-surface-alt)]">
              <div className="text-2xl font-bold text-[var(--color-text-900)]">{g.approvalCounts.total}</div>
              <div className="text-xs text-[var(--color-text-600)] font-medium mt-0.5">Total Submitted</div>
            </div>
          </div>
        </div>

        {/* Peer Evaluation */}
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-500" />
              <h3 className="text-[var(--color-text-900)] font-semibold text-sm">Peer Evaluation</h3>
            </div>
            <span className="text-xs font-semibold text-pink-600 bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-full">
              {g.peerEvaluation.componentWeight} marks
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-600)] mb-4">
            Rate each teammate 1–5 — converted to {g.peerEvaluation.componentWeight} marks
          </p>

          {/* Received rating — read-only */}
          {g.peerEvaluation.averageRaw != null && (
            <div className="mb-4 pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs text-[var(--color-text-600)] mb-1">Your received rating</p>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-1">
                <span className="text-2xl font-bold tabular-nums text-[var(--color-text-900)]">
                  {g.peerEvaluation.averageRaw.toFixed(1)}
                </span>
                <span className="text-[var(--color-text-600)] text-sm">/ 5</span>
                <span className="text-xs text-[var(--color-text-600)]">
                  → {g.peerEvaluation.convertedScore != null ? g.peerEvaluation.convertedScore.toFixed(1) : '—'} / {g.peerEvaluation.componentWeight} marks
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-600)]">
                {g.peerEvaluation.receivedCount} peer{g.peerEvaluation.receivedCount !== 1 ? 's' : ''} rated you
              </p>
            </div>
          )}

          {/* Submit ratings for each peer */}
          {(g.peerEvaluation.hasSubmitted || peerSubmitted) && !peerEditing ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-1.5 text-xs text-green-700">
                  <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  You have submitted your peer evaluations
                </div>
                <button
                  type="button"
                  onClick={handlePeerEdit}
                  className="text-xs text-pink-600 hover:text-pink-700 font-medium underline underline-offset-2 flex-shrink-0"
                >
                  Edit
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--color-text-700)] mb-2">Rate your teammates</p>
              {g.students.filter((s) => s.id !== user.id).map((s) => (
                <div key={s.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-900)] truncate">{s.name}</span>
                    <span className="text-xs font-mono text-[var(--color-text-600)] flex-shrink-0">
                      {peerRatings[s.id] ?? '—'} / 5
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPeerRatings((prev) => ({ ...prev, [s.id]: n }))}
                        className={`w-9 h-9 rounded-lg border text-sm font-semibold transition-colors focus:outline-none ${
                          peerRatings[s.id] === n
                            ? 'bg-pink-500 text-white border-pink-500'
                            : 'bg-white text-[var(--color-text-700)] border-[var(--color-border)] hover:border-pink-400 hover:text-pink-600'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {peerSubmitError && (
                <p className="text-xs text-red-600 pt-1">{peerSubmitError}</p>
              )}
              <div className="flex gap-2 mt-2">
                {peerEditing && (
                  <button
                    type="button"
                    disabled={peerSubmitting}
                    onClick={() => { setPeerEditing(false); setPeerSubmitError(null); }}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-700)] bg-[var(--color-surface-alt)] hover:bg-[var(--color-border)] disabled:opacity-50 rounded-lg px-3 py-2 transition-colors font-medium border border-[var(--color-border)]"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  disabled={peerSubmitting}
                  onClick={handlePeerSubmit}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors font-medium"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {peerSubmitting ? 'Submitting…' : peerEditing ? 'Update Peer Evaluations' : 'Submit Peer Evaluations'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CPIS-498: Deliverables Table (collapsible) ──────────────────────── */}
      {g.courseType === '498' && g.deliverables && Object.keys(g.deliverables).length > 0 && (
        <div className="mb-5 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
          <button
            className="w-full p-5 flex items-center justify-between hover:bg-[var(--color-surface-alt)] transition-colors rounded-t-xl"
            onClick={() => setDelivExpanded((v) => !v)}
          >
            <div className="text-left">
              <h3 className="text-[var(--color-text-900)] font-semibold">Course Deliverables Detail</h3>
              <p className="text-xs text-[var(--color-text-600)] mt-0.5">
                Graded by Coordinator · total {g.deliverablesTotal} / 15 marks
              </p>
            </div>
            {delivExpanded
              ? <ChevronUp className="w-5 h-5 text-[var(--color-text-600)]" />
              : <ChevronDown className="w-5 h-5 text-[var(--color-text-600)]" />}
          </button>

          {delivExpanded && (
            <div className="border-t border-[var(--color-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-alt)]">
                  <tr>
                    <th className="p-3 text-left text-[var(--color-text-700)] font-medium">Deliverable</th>
                    <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Score</th>
                    <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Max</th>
                    <th className="p-3 text-center text-[var(--color-text-700)] font-medium">Graded At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {Object.entries(g.deliverables).map(([key, d]) => (
                    <tr key={key} className="hover:bg-[var(--color-surface-alt)]/50">
                      <td className="p-3 text-[var(--color-text-900)]">
                        {DELIVERABLE_LABELS[key] ?? key}
                      </td>
                      <td className="p-3 text-center font-mono font-semibold text-[var(--color-text-900)]">
                        {d.score != null ? d.score : '—'}
                      </td>
                      <td className="p-3 text-center font-mono text-[var(--color-text-600)]">{d.maxScore}</td>
                      <td className="p-3 text-center text-xs text-[var(--color-text-600)]">
                        {d.gradedAt ? new Date(d.gradedAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}


      {/* ── Member Marks Dialog ─────────────────────────────────────────────── */}
      {memberDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMemberDialogOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  {memberDialogName} — Marks
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMemberDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4">
              {memberDialogLoading ? (
                <p className="text-center text-sm text-gray-500 py-8">Loading marks…</p>
              ) : !memberDialogData ? (
                <p className="text-center text-sm text-gray-400 py-8">No grade data available.</p>
              ) : (
                <div className="space-y-3">
                  <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Component</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-4 py-2 text-gray-800">Supervisor Evaluation</td>
                        <td className="px-4 py-2 text-right font-mono text-sm">
                          {memberDialogData.supervisorAssessment.score != null
                            ? `${Number(memberDialogData.supervisorAssessment.score).toFixed(1)} / ${memberDialogData.supervisorAssessment.maxScore}`
                            : '—'}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 text-gray-800">Committee Evaluation</td>
                        <td className="px-4 py-2 text-right font-mono text-sm">
                          {memberDialogData.committeeEvaluation.score != null
                            ? `${Number(memberDialogData.committeeEvaluation.score).toFixed(1)} / ${memberDialogData.committeeEvaluation.maxScore}`
                            : '—'}
                        </td>
                      </tr>
                      {memberDialogData.weeklyProgressScore != null && (
                        <tr>
                          <td className="px-4 py-2 text-gray-800">Weekly Progress</td>
                          <td className="px-4 py-2 text-right font-mono text-sm">
                            {Number(memberDialogData.weeklyProgressScore).toFixed(1)}
                          </td>
                        </tr>
                      )}
                      {memberDialogData.deliverablesTotal != null && (
                        <tr>
                          <td className="px-4 py-2 text-gray-800">Deliverables</td>
                          <td className="px-4 py-2 text-right font-mono text-sm">
                            {Number(memberDialogData.deliverablesTotal).toFixed(1)} / 15
                          </td>
                        </tr>
                      )}
                      {memberDialogData.adminCommitteeTotal != null && (
                        <tr>
                          <td className="px-4 py-2 text-gray-800">Admin Committee</td>
                          <td className="px-4 py-2 text-right font-mono text-sm">
                            {Number(memberDialogData.adminCommitteeTotal).toFixed(1)} / 15
                          </td>
                        </tr>
                      )}
                      {memberDialogData.peerFeedback.score != null && (
                        <tr>
                          <td className="px-4 py-2 text-gray-800">Peer Evaluation</td>
                          <td className="px-4 py-2 text-right font-mono text-sm">
                            {Number(memberDialogData.peerFeedback.score).toFixed(2)} / {memberDialogData.peerFeedback.maxScore}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-blue-50 border-t-2 border-blue-200">
                        <td className="px-4 py-3 font-bold text-gray-900 text-sm">Total</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-900 font-mono">
                          {Number(memberDialogData.totalScore).toFixed(1)} / 100
                          {memberDialogData.finalGrade && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                              {memberDialogData.finalGrade}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
