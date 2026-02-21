import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { Settings, Bell, BarChart3, Users, AlertTriangle, CheckCircle, Clock, FileText, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import {
  getAdminStats,
  getSubmissionVolumeLastWeek,
  getEvaluationProgressByCourse,
  getRecentActivity,
  getUpcomingEvents,
} from '../../services/dashboard';
import type {
  AdminStats,
  SubmissionVolumeDay,
  EvaluationProgress,
  ActivityEntry,
  UpcomingEvent,
} from '../../services/dashboard';

// ── Quick-action definitions ──────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: Settings,  label: 'Configure Milestones',  path: '/admin/milestones' },
  { icon: Bell,      label: 'Create Announcement',   path: '/admin/announcements' },
  { icon: BarChart3, label: 'Export Reports',         path: '/admin/exports' },
  { icon: Users,     label: 'Manage Users',           path: '/admin/users' },
] as const;

// ── Color maps ────────────────────────────────────────────────────────────────
const ACTIVITY_BAR: Record<string, string> = {
  blue:   'bg-blue-400',
  green:  'bg-emerald-400',
  purple: 'bg-purple-400',
  amber:  'bg-amber-400',
  gray:   'bg-gray-300',
};

const EVENT_CARD: Record<string, string> = {
  blue:   'border-blue-400   bg-blue-50/60',
  purple: 'border-purple-400 bg-purple-50/60',
  green:  'border-emerald-400 bg-emerald-50/60',
  amber:  'border-amber-400  bg-amber-50/60',
};

const EVENT_LABEL: Record<string, string> = {
  blue:   'text-blue-600',
  purple: 'text-purple-600',
  green:  'text-emerald-600',
  amber:  'text-amber-600',
};

// ─────────────────────────────────────────────────────────────────────────────

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0, overdueSubmissions: 0, upcomingDeadlines: 0, completedProjects: 0, completionRate: 0,
  });
  const [submissionVolume, setSubmissionVolume] = useState<SubmissionVolumeDay[]>([]);
  const [evalProgress, setEvalProgress] = useState<EvaluationProgress>({
    courses: [], overallEvaluated: 0, overallTotal: 0, overallPercent: 0,
  });
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getAdminStats(),
      getSubmissionVolumeLastWeek(),
      getEvaluationProgressByCourse(),
      getRecentActivity(5),
      getUpcomingEvents(3),
    ]).then(([s, vol, eval_, activity, events]) => {
      setStats(s);
      setSubmissionVolume(vol);
      setEvalProgress(eval_);
      setRecentActivity(activity);
      setUpcomingEvents(events);
    }).finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  if (loading) {
    return (
      <Layout user={user} pageTitle="Admin Dashboard">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="!bg-white rounded-xl border border-[var(--color-border)] p-6 h-36 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="!bg-white rounded-xl border border-[var(--color-border)] h-64 animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  const maxSubmissions = submissionVolume.length > 0 ? Math.max(...submissionVolume.map(d => d.count), 1) : 1;

  return (
    <Layout user={user} pageTitle="Admin Dashboard">

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard label="Total Students"       value={stats.totalStudents}       icon={Users}          color="primary" />
        <MetricCard label="Overdue Submissions"  value={stats.overdueSubmissions}  icon={AlertTriangle}  color="danger"  />
        <MetricCard label="Upcoming Deadlines"   value={stats.upcomingDeadlines}   icon={Clock}          color="warning" />
        <MetricCard
          label="Completed Projects"
          value={stats.completedProjects}
          icon={CheckCircle}
          color="success"
          trend={stats.completionRate > 0 ? { value: `${stats.completionRate}% completion rate`, positive: true } : undefined}
        />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Quick Actions ──────────────────────────────────────────────────── */}
        <DashboardCard title="Quick Actions" icon={Settings}>
          <div className="space-y-2">
            {QUICK_ACTIONS.map(({ icon: ActionIcon, label, path }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[var(--color-text-700)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text-900)] transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-100)] flex items-center justify-center shrink-0 group-hover:bg-[var(--color-primary-600)] transition-colors">
                  <ActionIcon className="w-4 h-4 text-[var(--color-primary-600)] group-hover:text-white transition-colors" />
                </div>
                {label}
              </button>
            ))}
          </div>
        </DashboardCard>

        {/* Submission Volume ──────────────────────────────────────────────── */}
        <DashboardCard title="Submission Volume (Last 7 Days)" icon={FileText}>
          {submissionVolume.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No submissions this week</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">Submission data will appear once students start submitting</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {submissionVolume.map((data) => (
                <div key={data.day} className="flex items-center gap-3">
                  <span className="w-[88px] shrink-0 text-xs font-medium text-[var(--color-text-600)]">{data.day}</span>
                  <div className="flex-1 bg-[var(--color-surface-alt)] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-[var(--color-primary-600)] h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${Math.max((data.count / maxSubmissions) * 100, data.count > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span className="w-5 shrink-0 text-xs font-semibold text-[var(--color-text-900)] text-right tabular-nums">
                    {data.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Evaluation Progress ────────────────────────────────────────────── */}
        <DashboardCard title="Evaluation Progress by Course" icon={BarChart3}>
          {evalProgress.courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <BarChart3 className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No evaluation data yet</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">Data will appear once supervisor assessments are submitted</p>
            </div>
          ) : (
            <div className="space-y-5">
              {evalProgress.courses.map((c) => (
                <div key={c.course}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[var(--color-text-900)]">{c.course}</span>
                    <span className="text-xs text-[var(--color-text-600)] tabular-nums">{c.evaluated}/{c.total} ({c.percent}%)</span>
                  </div>
                  <div className="w-full bg-[var(--color-surface-alt)] rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${c.percent}%` }}
                    />
                  </div>
                </div>
              ))}

              {evalProgress.overallTotal > 0 && (
                <div className="mt-2 pt-4 border-t border-[var(--color-border)]">
                  <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-xs font-medium text-emerald-700">Overall completion</p>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-700 leading-none">{evalProgress.overallPercent}%</p>
                      <p className="text-xs text-emerald-600 mt-0.5 tabular-nums">{evalProgress.overallEvaluated}/{evalProgress.overallTotal} evaluated</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </DashboardCard>

        {/* System Activity ────────────────────────────────────────────────── */}
        <DashboardCard title="System Activity" icon={Clock}>
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No recent activity</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">System events will be logged here</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`w-1 self-stretch rounded-full shrink-0 ${ACTIVITY_BAR[entry.color] ?? 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-900)] leading-snug">
                      {typeof entry.message === 'string' ? entry.message : JSON.stringify(entry.message)}
                    </p>
                    <p className="text-xs text-[var(--color-text-600)] mt-0.5">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

        {/* Upcoming Events ────────────────────────────────────────────────── */}
        <DashboardCard title="Upcoming Events" icon={CalendarDays} className="lg:col-span-2">
          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <CalendarDays className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No upcoming events</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">Upcoming milestones and deadlines will appear here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${EVENT_CARD[event.color] ?? 'border-gray-300 bg-gray-50'} hover:shadow-sm transition-shadow`}
                >
                  <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-1.5 leading-snug">{event.title}</h3>
                  <p className="text-xs text-[var(--color-text-600)] mb-1">{event.date}</p>
                  <p className={`text-xs font-medium ${EVENT_LABEL[event.color] ?? 'text-gray-600'}`}>{event.detail}</p>
                </div>
              ))}
            </div>
          )}
        </DashboardCard>

      </div>

    </Layout>
  );
}
