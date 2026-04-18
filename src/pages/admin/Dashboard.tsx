import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAllCourses } from '../../services/courses';
import { getKpiData, getAllCourseKpis } from '../../services/dashboard';
import type { KpiData, CourseKpi } from '../../services/dashboard';
import type { Course } from '../../types';
import { SparklineChart, DonutChart, GaugeChart, AttentionBarChart } from '../../features/dashboard/components/KpiCharts';
import {
  FolderGit2, Activity, ShieldCheck, AlertTriangle,
  Clock, AlertOctagon, CheckCircle2, TrendingUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '30d' | 'all';
type KpiBoth = { d30: KpiData; all: KpiData };
type CourseKpiBoth = { d30: CourseKpi[]; all: CourseKpi[] };

// ─── Primitives ───────────────────────────────────────────────────────────────

function KpiCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-(--color-surface-white) rounded-xl border border-(--color-border) shadow-sm p-6 flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionCard({ children, header }: { children: React.ReactNode; header: React.ReactNode }) {
  return (
    <div className="bg-(--color-surface-white) rounded-xl border border-(--color-border) shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-(--color-border)">
        {header}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function CardHeader({
  icon: Icon, label,
  iconBg = 'bg-(--color-primary-100)',
  iconColor = 'text-(--color-primary-600)',
}: { icon: React.ElementType; label: string; iconBg?: string; iconColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
      </div>
      <span className="text-xs font-semibold uppercase tracking-wide text-(--color-text-600)">{label}</span>
    </div>
  );
}

function TimeRangeToggle({ value, onChange }: { value: TimeRange; onChange: (v: TimeRange) => void }) {
  return (
    <div className="flex rounded-lg border border-(--color-border) overflow-hidden text-[11px] ml-auto shrink-0">
      {(['30d', 'all'] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`px-2.5 py-1 font-medium transition-colors ${
            value === v
              ? 'bg-(--color-primary-600) text-white'
              : 'bg-(--color-surface-white) text-(--color-text-500) hover:bg-(--color-surface-alt)'
          }`}
        >
          {v === '30d' ? 'Last 30d' : 'All Time'}
        </button>
      ))}
    </div>
  );
}

// ─── KPI 1: Active Projects + Sparkline ──────────────────────────────────────

function ActiveProjectsCard({ kpis }: { kpis: KpiBoth }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const kpi = range === '30d' ? kpis.d30 : kpis.all;
  const trend = kpi.sparkline[5] - kpi.sparkline[4];
  return (
    <KpiCard>
      <div className="flex items-center gap-2">
        <CardHeader icon={FolderGit2} label="Total Active Projects" />
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>
      <div>
        <p className="text-4xl font-bold text-(--color-text-900) leading-none tabular-nums">
          {kpi.totalActiveProjects}
        </p>
        <p className="text-xs text-(--color-text-500) mt-1.5">Approved graduation groups</p>
      </div>
      <div>
        <SparklineChart data={kpi.sparkline} />
        <div className="flex items-center justify-between mt-1 px-0.5">
          <span className="text-[10px] text-(--color-text-400)">6 wks ago</span>
          {trend !== 0 && (
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
              <TrendingUp className={`w-3 h-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              {trend > 0 ? '+' : ''}{trend} this week
            </span>
          )}
          <span className="text-[10px] text-(--color-text-400)">Now</span>
        </div>
      </div>
    </KpiCard>
  );
}

// ─── KPI 2: Submission Activity Rate (Donut) ──────────────────────────────────

function SubmissionActivityCard({ kpis }: { kpis: KpiBoth }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const kpi = range === '30d' ? kpis.d30 : kpis.all;
  const rateColor =
    kpi.submissionActivityRate >= 70 ? 'text-green-600'
    : kpi.submissionActivityRate >= 40 ? 'text-amber-600'
    : 'text-red-600';
  return (
    <KpiCard>
      <div className="flex items-center gap-2">
        <CardHeader icon={Activity} label="Submission Activity" iconBg="bg-green-50" iconColor="text-green-700" />
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>
      <div className="flex items-center gap-5">
        <DonutChart activeCount={kpi.activeGroupsCount} totalCount={kpi.totalGroupsCount} />
        <div className="flex flex-col gap-2.5 min-w-0">
          <div>
            <p className={`text-2xl font-bold leading-none tabular-nums ${rateColor}`}>
              {kpi.submissionActivityRate}%
            </p>
            <p className="text-xs text-(--color-text-500) mt-0.5">
              {range === '30d' ? 'Activity rate (30d)' : 'Activity rate (all time)'}
            </p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-(--color-text-600)">
              <span className="w-2 h-2 rounded-full bg-[#1F7A5C] shrink-0" />
              <span className="tabular-nums font-medium">{kpi.activeGroupsCount}</span>
              <span>submitted</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-(--color-text-500)">
              <span className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
              <span className="tabular-nums font-medium">{kpi.totalGroupsCount - kpi.activeGroupsCount}</span>
              <span>unsubmitted</span>
            </div>
          </div>
        </div>
      </div>
    </KpiCard>
  );
}

// ─── KPI 3: Review Completion Rate (Gauge) ────────────────────────────────────

function ReviewCompletionCard({ kpis }: { kpis: KpiBoth }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const kpi = range === '30d' ? kpis.d30 : kpis.all;
  const rateColor =
    kpi.reviewCompletionRate >= 70 ? 'text-green-600'
    : kpi.reviewCompletionRate >= 40 ? 'text-amber-600'
    : 'text-red-600';
  return (
    <KpiCard>
      <div className="flex items-center gap-2">
        <CardHeader icon={ShieldCheck} label="Review Completion" iconBg="bg-blue-50" iconColor="text-blue-600" />
        <TimeRangeToggle value={range} onChange={setRange} />
      </div>
      <GaugeChart value={kpi.reviewCompletionRate} />
      <div className="flex items-center justify-between text-xs text-(--color-text-600) pt-1 border-t border-(--color-border)">
        <span className="flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
          <span className={`font-semibold tabular-nums ${rateColor}`}>{kpi.reviewedCount}</span>
          <span>reviewed</span>
        </span>
        <span className="text-(--color-text-400)">/</span>
        <span><span className="font-semibold tabular-nums">{kpi.totalNonDraftCount}</span> total</span>
      </div>
    </KpiCard>
  );
}

// ─── KPI 4: Projects Requiring Attention ─────────────────────────────────────

function AttentionSection({ kpis }: { kpis: KpiBoth }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const kpi = range === '30d' ? kpis.d30 : kpis.all;
  const urgency =
    kpi.totalAttentionCount === 0 ? 'none'
    : kpi.overdueGroups > 0          ? 'high'
    : kpi.pendingReviewGroups > 5    ? 'medium'
    : 'low';

  const band = {
    none:   { border: 'border-green-200',  bg: 'bg-green-50',  icon: 'text-green-600',  badge: 'bg-green-100 text-green-700'  },
    low:    { border: 'border-amber-200',  bg: 'bg-amber-50',  icon: 'text-amber-600',  badge: 'bg-amber-100 text-amber-700'  },
    medium: { border: 'border-orange-200', bg: 'bg-orange-50', icon: 'text-orange-600', badge: 'bg-orange-100 text-orange-700' },
    high:   { border: 'border-red-200',    bg: 'bg-red-50',    icon: 'text-red-600',    badge: 'bg-red-100 text-red-700'      },
  }[urgency];

  return (
    <SectionCard
      header={
        <>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            </div>
            <h2 className="text-sm font-semibold text-(--color-text-900)">Projects Requiring Attention</h2>
            <span className="text-xs text-(--color-text-400) hidden sm:inline">— Primary decision-making KPI</span>
          </div>
          <div className="flex items-center gap-3">
            <TimeRangeToggle value={range} onChange={setRange} />
            <span className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${band.badge}`}>
              {kpi.totalAttentionCount} {kpi.totalAttentionCount === 1 ? 'project' : 'projects'}
            </span>
          </div>
        </>
      }
    >
      <div className="space-y-5">
        {kpi.totalAttentionCount === 0 ? (
          <div className={`flex items-center gap-4 rounded-xl border px-5 py-4 ${band.border} ${band.bg}`}>
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">All projects on track</p>
              <p className="text-xs text-green-700 mt-0.5">No projects require immediate attention at this time.</p>
            </div>
          </div>
        ) : (
          <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-5 py-3 ${band.border} ${band.bg}`}>
            <AlertOctagon className={`w-4 h-4 shrink-0 ${band.icon}`} />
            <span className="text-sm font-medium text-(--color-text-800)">
              {kpi.totalAttentionCount} {kpi.totalAttentionCount === 1 ? 'project requires' : 'projects require'} attention
            </span>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              {kpi.pendingReviewGroups > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold">
                  <Clock className="w-3 h-3" /> {kpi.pendingReviewGroups} Pending
                </span>
              )}
              {kpi.overdueGroups > 0 && (
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                  <AlertTriangle className="w-3 h-3" /> {kpi.overdueGroups} Overdue
                </span>
              )}
            </div>
          </div>
        )}
        <AttentionBarChart
          pending={kpi.pendingReviewGroups}
          overdue={kpi.overdueGroups}
        />
      </div>
    </SectionCard>
  );
}

// ─── Course KPI Comparison ────────────────────────────────────────────────────

function CourseComparisonSection({ courseKpis }: { courseKpis: CourseKpiBoth }) {
  const [range, setRange] = useState<TimeRange>('30d');
  const list = range === '30d' ? courseKpis.d30 : courseKpis.all;
  const isComparison = list.length > 1;
  return (
    <SectionCard
      header={
        <div className="flex items-center justify-between w-full gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-(--color-primary-100) flex items-center justify-center">
              <Activity className="w-3.5 h-3.5 text-(--color-primary-600)" />
            </div>
            <h2 className="text-sm font-semibold text-(--color-text-900)">
              {isComparison ? 'Course KPI Comparison' : 'Course Overview'}
            </h2>
          </div>
          <TimeRangeToggle value={range} onChange={setRange} />
        </div>
      }
    >
      <div className={`grid gap-5 ${isComparison ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
        {list.map((ck) => {
          const actColor = ck.kpi.submissionActivityRate >= 70 ? 'text-green-600' : ck.kpi.submissionActivityRate >= 40 ? 'text-amber-600' : 'text-red-600';
          const revColor = ck.kpi.reviewCompletionRate    >= 70 ? 'text-green-600' : ck.kpi.reviewCompletionRate    >= 40 ? 'text-amber-600' : 'text-red-600';
          const attColor = ck.kpi.totalAttentionCount     === 0 ? 'text-green-600' : ck.kpi.overdueGroups > 0        ? 'text-red-600'   : 'text-amber-600';

          return (
            <div key={ck.courseId} className="rounded-xl border border-(--color-border) p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="mb-4">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--color-primary-100) text-(--color-primary-700) border border-[#1F7A5C]/20">
                  {ck.courseCode}
                </span>
                <p className="text-sm font-semibold text-(--color-text-900) mt-1.5">{ck.courseName}</p>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-4">
                {[
                  { label: 'Projects',  value: ck.kpi.totalActiveProjects,       color: 'text-(--color-text-900)' },
                  { label: 'Activity',  value: `${ck.kpi.submissionActivityRate}%`, color: actColor },
                  { label: 'Reviews',   value: `${ck.kpi.reviewCompletionRate}%`,   color: revColor },
                  { label: 'Attention', value: ck.kpi.totalAttentionCount,          color: attColor },
                ].map(({ label, value, color }) => (
                  <div key={label} className="text-center">
                    <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                    <p className="text-[10px] text-(--color-text-500) mt-0.5 uppercase tracking-wide leading-tight">{label}</p>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-(--color-text-400) mb-1">
                  <span>Submission Activity</span>
                  <span>{ck.kpi.activeGroupsCount}/{ck.kpi.totalGroupsCount} groups</span>
                </div>
                <div className="h-1.5 bg-(--color-surface-alt) rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1F7A5C] rounded-full transition-all duration-700"
                    style={{ width: `${ck.kpi.submissionActivityRate}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-(--color-surface-white) rounded-xl border border-(--color-border) p-6 h-52 animate-pulse" />
        ))}
      </div>
      <div className="bg-(--color-surface-white) rounded-xl border border-(--color-border) h-48 animate-pulse" />
      <div className="bg-(--color-surface-white) rounded-xl border border-(--color-border) h-44 animate-pulse" />
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

const THIRTY_DAYS_AGO = () => new Date(Date.now() - 30 * 24 * 3_600_000).toISOString();

export function AdminDashboard() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [kpis, setKpis] = useState<KpiBoth | null>(null);
  const [courseKpis, setCourseKpis] = useState<CourseKpiBoth>({ d30: [], all: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => { getAllCourses().then(setCourses); }, []);

  useEffect(() => {
    setLoading(true);
    const since30d = THIRTY_DAYS_AGO();
    const cid = selectedCourseId ?? undefined;

    const fetchCourseKpis = courseKpis.d30.length === 0
      ? Promise.all([getAllCourseKpis(since30d), getAllCourseKpis()])
      : Promise.resolve([courseKpis.d30, courseKpis.all] as [CourseKpi[], CourseKpi[]]);

    Promise.all([
      getKpiData(cid, since30d),
      getKpiData(cid),
      fetchCourseKpis,
    ]).then(([d30, all, [ck30d, ckAll]]) => {
      setKpis({ d30, all });
      if (courseKpis.d30.length === 0) setCourseKpis({ d30: ck30d, all: ckAll });
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  if (!user) return null;

  const selected = courses.find((c) => c.id === selectedCourseId);
  const subtitle = selected
    ? `${selected.code.replace('_', '-')} · ${selected.name}`
    : 'All Courses · Platform-Wide KPIs';

  const comparisonKpis: CourseKpiBoth = selectedCourseId && selected && kpis
    ? {
        d30: [{ courseId: selected.id, courseCode: selected.code.replace('_', '-'), courseName: selected.name, kpi: kpis.d30 }],
        all: [{ courseId: selected.id, courseCode: selected.code.replace('_', '-'), courseName: selected.name, kpi: kpis.all }],
      }
    : courseKpis;

  return (
    <Layout user={user} pageTitle="Analytical Dashboard" subtitle={subtitle}>

      {/* Course filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <span className="text-xs font-medium text-(--color-text-500) uppercase tracking-wide mr-1">Course:</span>
        {[{ id: null, label: 'All Courses' }, ...courses.map((c) => ({ id: c.id, label: c.code.replace('_', '-') }))].map(({ id, label }) => (
          <button
            key={id ?? '__all'}
            onClick={() => setSelectedCourseId(id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-150 ${
              selectedCourseId === id
                ? 'bg-(--color-primary-600) text-white shadow-sm'
                : 'bg-(--color-surface-alt) text-(--color-text-700) hover:bg-(--color-border)'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || !kpis ? <LoadingSkeleton /> : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <ActiveProjectsCard kpis={kpis} />
            <SubmissionActivityCard kpis={kpis} />
            <ReviewCompletionCard kpis={kpis} />
          </div>
          <AttentionSection kpis={kpis} />
          {(comparisonKpis.d30.length > 0 || comparisonKpis.all.length > 0) && (
            <CourseComparisonSection courseKpis={comparisonKpis} />
          )}
        </div>
      )}

    </Layout>
  );
}
