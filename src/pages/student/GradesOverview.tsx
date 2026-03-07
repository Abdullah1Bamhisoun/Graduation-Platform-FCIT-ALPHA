import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { getWeekStatuses, getDisplayStatus } from '../../services/week-statuses';
import { getAllRubricCriteria } from '../../services/grading-rubric';
import type { RubricCriterion } from '../../services/grading-rubric';
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
} from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import type { WeekStatus } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GradeComponentItem {
  componentKey: string;
  componentName: string;
  totalMarks: number;
  evaluatorRole: string;
  score: number | null;
  maxScore: number;
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
  } | null;
  committeeEvaluation: { score: number; maxScore: number } | null;
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchMyGrades(token: string): Promise<StudentMyGradesData | null> {
  try {
    const res = await fetch('/api/students/my-grades', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch {
    // Fallback: build minimal grade data directly from Supabase
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: membership } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)
        .maybeSingle();
      if (!membership) return null;

      const { data: group } = await supabase
        .from('groups')
        .select('*, course:courses(code), supervisor:profiles!supervisor_id(name), members:group_members(student:profiles!student_id(id, name))')
        .eq('id', membership.group_id)
        .maybeSingle();
      if (!group) return null;

      const g = group as any;
      const courseCode = g.course?.code ?? '';
      const courseNum = String(g.course_number ?? '');
      const courseType: '498' | '499' = (courseNum.includes('499') || courseCode.includes('499')) ? '499' : '498';

      // Fetch grade components from Supabase so grade scheme is visible
      const { data: comps } = await supabase
        .from('grading_components')
        .select('*')
        .eq('course_type', courseType)
        .eq('is_active', true)
        .order('display_order');
      const components: GradeComponentItem[] = (comps || []).map((c: any) => ({
        componentKey: c.component_key,
        componentName: c.component_name,
        totalMarks: c.total_marks,
        evaluatorRole: c.evaluator_role,
        score: null,
        maxScore: c.total_marks,
      }));

      return {
        groupId: g.id,
        groupNumber: g.group_number ?? 0,
        projectName: g.project_name ?? '',
        status: g.status ?? 'active',
        projectStatus: (g.project_status === 'ip' ? 'ip' : 'normal') as 'normal' | 'ip',
        ipMarkedAt: g.ip_marked_at ?? null,
        ipReason: g.ip_reason ?? null,
        courseCode,
        courseType,
        supervisorName: g.supervisor?.name ?? null,
        students: ((g.members ?? []) as any[]).map((m: any) => ({ id: m.student?.id ?? '', name: m.student?.name ?? '' })),
        components,
        supervisorEvaluation: null,
        committeeEvaluation: null,
        approvalCounts: { total: 0, pending: 0, approved: 0, rejected: 0 },
        weeklyScore: 0,
        weeklyMaxScore: 0,
        weeklyTotalRaw: 0,
        weeksOpened: 0,
        weeklyIsAtCap: false,
        weeklyBreakdown: [],
        peerEvaluation: { receivedCount: 0, averageRaw: null, convertedScore: null, componentWeight: 0, hasSubmitted: false },
        deliverables: null,
        deliverablesTotal: 0,
        totalScore: 0,
        finalGrade: '—',
      };
    } catch {
      return null;
    }
  }
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
  const [peerRatings, setPeerRatings]       = useState<Record<string, number>>({});
  const [peerSubmitting, setPeerSubmitting] = useState(false);
  const [peerSubmitError, setPeerSubmitError] = useState<string | null>(null);
  const [peerSubmitted, setPeerSubmitted]   = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [rubricCriteria, setRubricCriteria] = useState<RubricCriterion[]>([]);
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set());
  const [criterionScores, setCriterionScores] = useState<Record<string, number>>({});
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) return;

      const grades = await fetchMyGrades(token);
      setGradesData(grades);

      if (grades) {
        const [ws, criteria] = await Promise.all([
          getWeekStatuses(grades.courseType, 'DEFAULT'),
          getAllRubricCriteria(grades.courseType),
        ]);
        setWeekStatuses(ws);
        setRubricCriteria(criteria);

        // Fetch per-criterion scores for this student's group
        const { data: courseRow } = await supabase
          .from('courses')
          .select('id')
          .eq('code', grades.courseCode)
          .limit(1)
          .maybeSingle();

        if (courseRow) {
          const [{ data: supScores }, { data: commScores }, { data: coordDelivScores }] = await Promise.all([
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
            supabase
              .from('coordinator_deliverable_scores')
              .select('deliverable_key, score')
              .eq('group_id', grades.groupId)
              .eq('course_id', courseRow.id),
          ]);

          const scores: Record<string, number> = {};
          for (const s of supScores ?? []) {
            scores[s.criterion_key] = Number(s.raw_score);
          }
          // Average committee scores per criterion (don't overwrite supervisor scores)
          const commSums: Record<string, number[]> = {};
          for (const s of commScores ?? []) {
            (commSums[s.criterion_key] ??= []).push(Number(s.score));
          }
          for (const [key, vals] of Object.entries(commSums)) {
            if (!(key in scores)) {
              scores[key] = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
          }
          // Coordinator deliverable scores (CommitteeScores page) for 499 criteria display
          for (const s of coordDelivScores ?? []) {
            if (!(s.deliverable_key in scores)) {
              scores[s.deliverable_key] = Number(s.score);
            }
          }
          setCriterionScores(scores);
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
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const ratings: Record<string, number> = {};
      for (const s of peers) ratings[s.id] = peerRatings[s.id];

      const res = await fetch('/api/students/peer-evaluations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ratings }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      setPeerSubmitted(true);
    } catch (err) {
      setPeerSubmitError('Failed to submit. Please try again.');
    } finally {
      setPeerSubmitting(false);
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
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
            {/* Group members with "you" highlight */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {g.students.map((s) => (
                <span
                  key={s.id}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    s.id === user.id
                      ? 'bg-[var(--color-primary-100)] text-[var(--color-primary-700)] border-[var(--color-primary-300)] font-semibold'
                      : 'bg-[var(--color-surface-alt)] text-[var(--color-text-600)] border-[var(--color-border)]'
                  }`}
                >
                  {s.name}{s.id === user.id ? ' (you)' : ''}
                </span>
              ))}
            </div>
          </div>

          {/* Score + Grade badge */}
          <div className="text-right flex-shrink-0">
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span
                      className={`text-sm font-mono font-semibold tabular-nums ${
                        c.score != null ? getScoreColor(c.score, c.maxScore) : 'text-[var(--color-text-500)]'
                      }`}
                    >
                      {c.score != null ? c.score.toFixed(1) : '—'}
                    </span>
                    <span className="text-xs text-[var(--color-text-500)]">/ {c.maxScore}</span>
                    <div className="w-20 bg-gray-200 rounded-full h-1.5 hidden sm:block">
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
                                      — {hasScore ? `${Math.round(rawScore)} / ${criterion.maxRawScore}` : `/ ${criterion.maxRawScore}`}
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
                                      — {hasScore ? `${Math.round(rawScore)} / ${criterion.maxRawScore}` : `/ ${criterion.maxRawScore}`}
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
                                        <span className={`text-xs font-bold w-32 flex-shrink-0 ${isCurrentLevel ? 'text-[var(--color-primary-700)]' : 'text-[var(--color-text-700)]'}`}>
                                          {level.score}. {level.label}
                                          {isCurrentLevel && (
                                            <span className="ml-1 text-[10px] font-semibold text-[var(--color-primary-600)]">← your grade</span>
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
              <div className="flex items-baseline gap-2 mb-1">
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
          {g.peerEvaluation.hasSubmitted || peerSubmitted ? (
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              You have submitted your peer evaluations
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
              <button
                type="button"
                disabled={peerSubmitting}
                onClick={handlePeerSubmit}
                className="w-full mt-2 flex items-center justify-center gap-1.5 text-xs text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-50 rounded-lg px-3 py-2 transition-colors font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {peerSubmitting ? 'Submitting…' : 'Submit Peer Evaluations'}
              </button>
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


    </Layout>
  );
}
