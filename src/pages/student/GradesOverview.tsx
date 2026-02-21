import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getStudentGrade } from '../../services/grades';
import { getGradingSchemas } from '../../services/grading-schemas';
import { getWeekStatuses, getDisplayStatus } from '../../services/week-statuses';
import { getGroupForStudent } from '../../services/groups';
import { getAdminCommitteeScore } from '../../services/admin-committee-scores';
import { CheckCircle, Clock, XCircle, Info, AlertTriangle, Lock, ChevronDown, ChevronUp, TrendingUp } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { GradingSchema, WeekStatus, StudentGrade, AdminCommitteeScore } from '../../types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

function getGradeColor(pct: number) {
  if (pct >= 90) return 'text-green-600';
  if (pct >= 80) return 'text-blue-600';
  if (pct >= 70) return 'text-yellow-600';
  if (pct >= 60) return 'text-orange-600';
  return 'text-red-600';
}

function ProgressBar({ value, max, color = 'bg-blue-600' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2">
      <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
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
  const [studentGrade, setStudentGrade]       = useState<StudentGrade | null>(null);
  const [schemas, setSchemas]                 = useState<GradingSchema[]>([]);
  const [weekStatuses, setWeekStatuses]       = useState<WeekStatus[]>([]);
  const [adminScore, setAdminScore]           = useState<AdminCommitteeScore | null>(null);
  const [courseCode, setCourseCode]           = useState('');
  const [groupId, setGroupId]                 = useState<string | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [weeklyExpanded, setWeeklyExpanded]   = useState(false);

  const SEMESTER = 'DEFAULT';

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const group = await getGroupForStudent(user.id);
        const resolvedCode = group?.courseCode || 'CPIS-498';
        const ct = courseTypeFromCode(resolvedCode);
        setCourseCode(resolvedCode);
        setGroupId(group?.id ?? null);

        const [sg, sc, ws] = await Promise.all([
          group ? getStudentGrade(user.id, resolvedCode, SEMESTER) : null,
          getGradingSchemas(ct, SEMESTER),
          getWeekStatuses(ct, SEMESTER),
        ]);

        setStudentGrade(sg);
        setSchemas(sc);
        setWeekStatuses(ws);

        // CPIS-499: fetch coordinator committee score
        if (ct === '499' && group) {
          const ac = await getAdminCommitteeScore(group.id, SEMESTER);
          setAdminScore(ac);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (!user) return null;

  if (loading) {
    return (
      <Layout user={user} pageTitle="My Grades">
        <div className="p-6 text-[var(--color-text-600)]">Loading grades...</div>
      </Layout>
    );
  }

  const ct = courseTypeFromCode(courseCode || 'CPIS-498');
  const noGroup   = !groupId;
  const noGrades  = !studentGrade || (
    studentGrade.supervisorAssessment.score === undefined &&
    studentGrade.committeeEvaluation.score  === undefined &&
    studentGrade.weeklyProgressScore        === undefined &&
    studentGrade.deliverablesTotal          === undefined &&
    studentGrade.peerFeedback.score         === undefined
  );

  // Weekly summary — uses capped scoring (min(totalRaw, maxWeeklyMarks))
  const weeksOpened      = weekStatuses.filter(ws => ws.wasOpened).length;
  const maxRaw           = weeksOpened * 2;
  const weeklyMaxMarks   = (studentGrade as any)?._weeklyMaxMarks ?? (ct === '499' ? 22 : 20);
  const weeklyTotalRaw   = (studentGrade as any)?._weeklyTotalRaw ?? 0;
  const weeklyIsAtCap    = (studentGrade as any)?._weeklyIsAtCap ?? false;
  const weekMarks        = (studentGrade as any)?._weekMarks as Record<number, { studentMark: number; supervisorMark: number }> | undefined;

  // Compute total score from schema weights
  const totalScore = studentGrade
    ? (studentGrade.supervisorAssessment.score  ?? 0) +
      (studentGrade.committeeEvaluation.score   ?? 0) +
      (studentGrade.weeklyProgressScore         ?? 0) +
      (studentGrade.deliverablesTotal           ?? 0) +
      (studentGrade.peerFeedback.score          ?? 0)
    : 0;

  return (
    <Layout user={user} pageTitle={`My Grades${courseCode ? ` — ${courseCode}` : ''}`}>

      {/* ── Banner: No group ─────────────────────────────────────── */}
      {noGroup && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <AlertTriangle className="mt-0.5 w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 text-sm">
            You are not assigned to a group yet. Grading criteria is shown below for reference.
          </p>
        </div>
      )}

      {/* ── Banner: No grades entered ────────────────────────────── */}
      {!noGroup && noGrades && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-300 bg-blue-50 p-4">
          <Info className="mt-0.5 w-5 h-5 text-blue-600 flex-shrink-0" />
          <p className="text-blue-800 text-sm">
            No grades have been entered yet. Grading criteria is shown below.
          </p>
        </div>
      )}

      {/* ── Summary header ───────────────────────────────────────── */}
      {studentGrade && (
        <div className="mb-6 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-[var(--color-text-900)] mb-1">{studentGrade.studentName}</h2>
              <p className="text-[var(--color-text-600)] text-sm">
                {courseCode} &nbsp;|&nbsp; Group: {studentGrade.groupId || '—'}
              </p>
            </div>
            <div className="text-right">
              <div className={`text-5xl mb-1 font-bold tabular-nums ${getGradeColor(totalScore)}`}>
                {totalScore.toFixed(1)}
              </div>
              <div className="text-[var(--color-text-600)] text-sm">/ 100 &nbsp;·&nbsp; {studentGrade.finalGrade}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Schema-driven grade cards ─────────────────────────────── */}
      {/* SPEC §12: ALWAYS render schema, even if no grades. Never early return. */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-6">
        {schemas.map(schema => {
          const { componentName, weight } = schema;
          const lc = componentName.toLowerCase();

          // ── Supervisor Assessment card ──
          if (lc.includes('supervisor')) {
            const score = studentGrade?.supervisorAssessment.score;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <span className="text-xs text-[var(--color-text-600)] bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">{weight}%</span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {score !== undefined ? score : '—'}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
                </div>
                {score !== undefined
                  ? <ProgressBar value={score} max={weight} color="bg-purple-500" />
                  : <p className="text-xs text-[var(--color-text-600)]">Not graded yet</p>}
              </div>
            );
          }

          // ── Weekly card ──
          if (lc.includes('weekly') || lc.includes('progress')) {
            const score = studentGrade?.weeklyProgressScore ?? 0;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <div className="flex items-center gap-1.5">
                    {weeklyIsAtCap && (
                      <span className="text-xs text-green-700 bg-green-50 border border-green-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Cap reached
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-600)] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">{weight}%</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {score}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weeklyMaxMarks}</span>
                </div>
                <ProgressBar value={score} max={weeklyMaxMarks} color={weeklyIsAtCap ? 'bg-green-600' : 'bg-green-500'} />
                <p className="text-xs text-[var(--color-text-600)] mt-2">
                  {weeksOpened === 0
                    ? 'No weekly sessions activated this semester.'
                    : weeklyIsAtCap
                      ? `Maximum reached — ${weeksOpened} week${weeksOpened !== 1 ? 's' : ''} activated · ${weeklyTotalRaw} raw marks (capped at ${weeklyMaxMarks})`
                      : `${weeksOpened} week${weeksOpened !== 1 ? 's' : ''} activated · ${weeklyTotalRaw} / ${weeklyMaxMarks} marks earned`}
                </p>
              </div>
            );
          }

          // ── Committee (40%) card ──
          if (lc.includes('committee') || lc.includes('examination')) {
            const score = studentGrade?.committeeEvaluation.score;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <span className="text-xs text-[var(--color-text-600)] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">{weight}%</span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {score !== undefined ? score.toFixed(1) : '—'}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
                </div>
                {score !== undefined
                  ? <ProgressBar value={score} max={weight} color="bg-orange-500" />
                  : <p className="text-xs text-[var(--color-text-600)]">Not evaluated yet</p>}
              </div>
            );
          }

          // ── Deliverables (CPIS-498 only) card ──
          if (lc.includes('deliverable') && ct === '498') {
            const total = studentGrade?.deliverablesTotal ?? 0;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <span className="text-xs text-[var(--color-text-600)] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">{weight}%</span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {total}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
                </div>
                <ProgressBar value={total} max={weight} color="bg-blue-500" />
                <p className="text-xs text-[var(--color-text-600)] mt-2">Group grade</p>
              </div>
            );
          }

          // ── Peer Feedback (CPIS-498 only) card ──
          if (lc.includes('peer') && ct === '498') {
            const score = studentGrade?.peerFeedback.score;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <span className="text-xs text-[var(--color-text-600)] bg-pink-50 border border-pink-200 px-2 py-0.5 rounded-full">{weight}%</span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {score !== undefined ? score.toFixed(1) : '—'}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
                </div>
                {score !== undefined
                  ? <ProgressBar value={score} max={weight} color="bg-pink-500" />
                  : <p className="text-xs text-[var(--color-text-600)]">Not submitted yet</p>}
              </div>
            );
          }

          // ── Senior Project Committee (CPIS-499 only) card ──
          if (lc.includes('senior') || lc.includes('project committee')) {
            if (ct !== '499') return null;
            const ac = adminScore;
            return (
              <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                  <span className="text-xs text-[var(--color-text-600)] bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">{weight}%</span>
                </div>
                <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                  {ac ? ac.totalScore.toFixed(1) : '—'}<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
                </div>
                {ac ? (
                  <>
                    <ProgressBar value={ac.totalScore} max={weight} color="bg-indigo-500" />
                    <div className="mt-3 space-y-1 text-xs text-[var(--color-text-600)]">
                      <div className="flex justify-between"><span>Poster Day</span><span>{ac.posterDayScore}/5</span></div>
                      <div className="flex justify-between"><span>Implementation Chapter</span><span>{ac.implementationScore}/5</span></div>
                      <div className="flex justify-between"><span>Testing Chapter</span><span>{ac.testingScore}/5</span></div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-text-600)]">Not graded yet</p>
                )}
              </div>
            );
          }

          // Generic fallback for any unrecognised component
          return (
            <div key={schema.id} className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[var(--color-text-900)] text-sm font-medium">{componentName}</h3>
                <span className="text-xs text-[var(--color-text-600)] bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">{weight}%</span>
              </div>
              <div className="text-3xl font-bold text-[var(--color-text-900)] mb-2 tabular-nums">
                —<span className="text-lg font-normal text-[var(--color-text-600)]">/{weight}</span>
              </div>
              <p className="text-xs text-[var(--color-text-600)]">Not graded yet</p>
            </div>
          );
        })}

        {/* Total Score card — always last */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border-2 border-blue-300 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[var(--color-text-900)] text-sm font-medium">Total Score</h3>
            <span className="text-xs text-blue-700 bg-blue-200 border border-blue-300 px-2 py-0.5 rounded-full">100%</span>
          </div>
          <div className={`text-4xl font-bold mb-1 tabular-nums ${getGradeColor(totalScore)}`}>
            {totalScore.toFixed(1)}<span className="text-xl font-normal text-[var(--color-text-600)]">/100</span>
          </div>
          <div className="text-sm font-medium text-[var(--color-text-900)]">
            Grade: {studentGrade?.finalGrade ?? 'In Progress'}
          </div>
          {totalScore < 60 && totalScore > 0 && (
            <p className="text-xs text-red-600 mt-1">Below passing threshold (60%)</p>
          )}
        </div>
      </div>

      {/* ── CPIS-498: Deliverables detail table ──────────────────── */}
      {ct === '498' && (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] mb-6">
          <div className="p-5 border-b border-[var(--color-border)]">
            <h3 className="text-[var(--color-text-900)] font-medium">Course Deliverables — Detail</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-alt)]">
                <tr>
                  <th className="p-4 text-left text-[var(--color-text-700)]">Deliverable</th>
                  <th className="p-4 text-center text-[var(--color-text-700)]">Status</th>
                  <th className="p-4 text-center text-[var(--color-text-700)]">Score</th>
                  <th className="p-4 text-center text-[var(--color-text-700)]">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {Object.entries(DELIVERABLE_LABELS).map(([key, label]) => {
                  const d = (studentGrade as any)?._groupDeliverables?.[key] ?? { status: 'not-submitted', maxScore: 0 };
                  const scoreVal: number | undefined = d.score;
                  const statusIcon = d.status === 'graded'
                    ? <CheckCircle className="w-4 h-4 text-green-600" />
                    : d.status === 'submitted'
                      ? <Clock className="w-4 h-4 text-yellow-500" />
                      : <XCircle className="w-4 h-4 text-gray-400" />;
                  const statusBadge = d.status === 'graded'
                    ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-600 border border-green-200">Graded</span>
                    : d.status === 'submitted'
                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-50 text-yellow-600 border border-yellow-200">Pending</span>
                      : <span className="px-2 py-0.5 text-xs rounded-full bg-gray-50 text-gray-500 border border-gray-200">Not Submitted</span>;
                  return (
                    <tr key={key}>
                      <td className="p-4 flex items-center gap-2 text-[var(--color-text-900)]">
                        {statusIcon}{label}
                      </td>
                      <td className="p-4 text-center">{statusBadge}</td>
                      <td className="p-4 text-center text-[var(--color-text-900)] font-mono">
                        {scoreVal !== undefined ? scoreVal : '—'}
                      </td>
                      <td className="p-4 text-center text-[var(--color-text-600)] font-mono">{d.maxScore}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 16-Week Breakdown ────────────────────────────────────── */}
      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] mb-6">
        <button
          className="w-full p-5 flex items-center justify-between border-b border-[var(--color-border)] hover:bg-[var(--color-surface-alt)] transition-colors"
          onClick={() => setWeeklyExpanded(v => !v)}
        >
          <div>
            <h3 className="text-[var(--color-text-900)] font-medium text-left">16-Week Breakdown</h3>
            <p className="text-xs text-[var(--color-text-600)] text-left mt-0.5">
              {weeksOpened} week{weeksOpened !== 1 ? 's' : ''} activated
              {weeksOpened > 0
                ? ` · ${weeklyTotalRaw} / ${weeklyMaxMarks} marks${weeklyIsAtCap ? ' (cap reached ✓)' : ''}`
                : ' · No sessions activated this semester'}
            </p>
          </div>
          {weeklyExpanded ? <ChevronUp className="w-5 h-5 text-[var(--color-text-600)]" /> : <ChevronDown className="w-5 h-5 text-[var(--color-text-600)]" />}
        </button>

        {weeklyExpanded && (
          <div className="overflow-x-auto">
            {/* Cap rule reminder */}
            <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 text-xs text-blue-700 flex items-center gap-2">
              <Info className="w-3.5 h-3.5 flex-shrink-0" />
              Each open week = 2 marks (1 submission + 1 supervisor response).
              Maximum weekly grade: <strong className="ml-1">{weeklyMaxMarks} marks</strong>.
              {weeklyIsAtCap && <span className="ml-1 font-semibold text-green-700"> Cap reached — no further marks added.</span>}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-alt)]">
                <tr>
                  <th className="p-3 text-left text-[var(--color-text-700)]">Week</th>
                  <th className="p-3 text-center text-[var(--color-text-700)]">Status</th>
                  <th className="p-3 text-center text-[var(--color-text-700)]">Submission</th>
                  <th className="p-3 text-center text-[var(--color-text-700)]">Supervisor</th>
                  <th className="p-3 text-center text-[var(--color-text-700)]">Week Total</th>
                  <th className="p-3 text-center text-[var(--color-text-700)]">Running Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {(() => {
                  let running = 0;
                  return Array.from({ length: 16 }, (_, i) => i + 1).map(wn => {
                    const ws = weekStatuses.find(s => s.weekNumber === wn);
                    const displayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                    const wasOpened = ws?.wasOpened ?? false;
                    const marks = weekMarks?.[wn];
                    const studentMark     = wasOpened ? (marks?.studentMark    ?? 0) : null;
                    const supervisorMark  = wasOpened ? (marks?.supervisorMark ?? 0) : null;
                    const weekTotal       = wasOpened ? (studentMark ?? 0) + (supervisorMark ?? 0) : null;

                    if (wasOpened && weekTotal !== null) running += weekTotal;
                    const cappedRunning = Math.min(running, weeklyMaxMarks);
                    const capHitThisWeek = wasOpened && running > weeklyMaxMarks && (running - (weekTotal ?? 0)) < weeklyMaxMarks;

                    const statusClass = WEEK_STATUS_STYLES[displayStatus] ?? WEEK_STATUS_STYLES['Not Opened'];

                    return (
                      <tr key={wn} className={!wasOpened ? 'opacity-50' : capHitThisWeek ? 'bg-green-50' : ''}>
                        <td className="p-3 text-[var(--color-text-900)]">
                          Week {wn}
                          {capHitThisWeek && <span className="ml-2 text-xs text-green-600 font-medium">(cap reached)</span>}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${statusClass}`}>
                            {displayStatus === 'Locked' && <Lock className="w-3 h-3" />}
                            {displayStatus}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono">
                          {studentMark !== null
                            ? <span className={studentMark === 1 ? 'text-green-600 font-semibold' : 'text-gray-400'}>{studentMark}/1</span>
                            : <span className="text-xs text-gray-400">excluded</span>}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {supervisorMark !== null
                            ? <span className={supervisorMark === 1 ? 'text-blue-600 font-semibold' : 'text-gray-400'}>{supervisorMark}/1</span>
                            : <span className="text-xs text-gray-400">excluded</span>}
                        </td>
                        <td className="p-3 text-center font-mono text-[var(--color-text-600)]">
                          {weekTotal !== null
                            ? <span className={weekTotal === 2 ? 'text-green-700 font-semibold' : ''}>{weekTotal}/2</span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="p-3 text-center font-mono">
                          {wasOpened
                            ? <span className={cappedRunning >= weeklyMaxMarks ? 'text-green-700 font-bold' : 'text-[var(--color-text-700)]'}>
                                {cappedRunning}/{weeklyMaxMarks}
                                {cappedRunning >= weeklyMaxMarks && ' ✓'}
                              </span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
            {weeksOpened === 0 && (
              <div className="p-5 text-center text-[var(--color-text-600)] text-sm">
                No weekly sessions were activated this semester.
              </div>
            )}
          </div>
        )}
      </div>

    </Layout>
  );
}
