import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { getCourseById } from '../../services/courses';
import {
  getAdminStats,
  getSubmissionVolumeLastWeek,
  getEvaluationProgressByCourse,
  getUpcomingEvents,
} from '../../services/dashboard';
import type {
  AdminStats,
  SubmissionVolumeDay,
  EvaluationProgress,
  UpcomingEvent,
} from '../../services/dashboard';
import {
  AlertCircle, BarChart3, Users,
  CheckCircle, Clock, FileText, CalendarDays, UserCheck,
} from 'lucide-react';
import { getPendingRegistrationsViaAPI, type PendingRegistration } from '../../lib/pending-registrations';
import type { Course } from '../../types';

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

export function CoordinatorDashboard() {
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<AdminStats>({
    totalStudents: 0, overdueSubmissions: 0, upcomingDeadlines: 0, completedProjects: 0, completionRate: 0,
  });
  const [submissionVolume, setSubmissionVolume] = useState<SubmissionVolumeDay[]>([]);
  const [evalProgress, setEvalProgress] = useState<EvaluationProgress>({
    courses: [], overallEvaluated: 0, overallTotal: 0, overallPercent: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingRegistration[]>([]);

  useEffect(() => {
    const fetchAndLoad = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch('/api/roles/coordinator-info', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const body: { coordinatorCourseId: string | null } = await res.json();
            if (body.coordinatorCourseId) {
              loadData(body.coordinatorCourseId);
              return;
            }
          }
        }
      } catch (_) { /* fall through */ }

      if (user?.coordinatorCourseId) {
        loadData(user.coordinatorCourseId);
        return;
      }
      setLoading(false);
    };

    fetchAndLoad();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadData = async (cId: string) => {
    setLoading(true);
    setCourseId(cId);
    try {
      const [courseData, s, vol, eval_, events, regs] = await Promise.all([
        getCourseById(cId),
        getAdminStats(cId),
        getSubmissionVolumeLastWeek(cId),
        getEvaluationProgressByCourse(cId),
        getUpcomingEvents(undefined, cId),
        getPendingRegistrationsViaAPI('coordinator'),
      ]);
      setCourse(courseData);
      setStats(s);
      setSubmissionVolume(vol);
      setEvalProgress(eval_);
      setUpcomingEvents(events);
      setPendingUsers(regs);
    } catch (err) {
      console.error('Error loading coordinator dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <Layout user={user} pageTitle="Coordinator Dashboard" subtitle={course ? `${course.code.replace('_', '-')} · ${course.name}` : undefined}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="!bg-white rounded-xl border border-[var(--color-border)] p-6 h-36 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="!bg-white rounded-xl border border-[var(--color-border)] h-64 animate-pulse" />
          ))}
        </div>
      </Layout>
    );
  }

  if (!courseId) {
    return (
      <Layout user={user} pageTitle="Coordinator Dashboard" subtitle={course ? `${course.code.replace('_', '-')} · ${course.name}` : undefined}>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium">No course assigned</p>
            <p className="text-amber-700 text-sm mt-1">Contact an administrator to assign you a course before you can use the coordinator dashboard.</p>
          </div>
        </div>
      </Layout>
    );
  }

  const maxSubmissions = submissionVolume.length > 0 ? Math.max(...submissionVolume.map(d => d.count), 1) : 1;

  return (
    <Layout user={user} pageTitle="Coordinator Dashboard" subtitle={course ? `${course.code.replace('_', '-')} · ${course.name}` : undefined}>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <MetricCard label="Total Students"     value={stats.totalStudents}     icon={Users}          color="primary" />
        <MetricCard label="Upcoming Deadlines" value={stats.upcomingDeadlines} icon={Clock}          color="warning" />
        <MetricCard
          label="Completed Projects"
          value={stats.completedProjects}
          icon={CheckCircle}
          color="success"
          trend={stats.completionRate > 0 ? { value: `${stats.completionRate}% completion rate`, positive: true } : undefined}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Submission Volume */}
        <DashboardCard title="Submission Volume (Last 7 Days)" icon={FileText}>
          {submissionVolume.every(d => d.count === 0) ? (
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
                      className="bg-purple-500 h-full rounded-full transition-all duration-700 ease-out"
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

        {/* Pending User Approvals */}
        <DashboardCard
          title="Pending User Approvals"
          icon={UserCheck}
          actions={
            <button
              onClick={() => navigate('/coordinator/approvals')}
              className="text-xs text-[var(--color-primary-600)] hover:underline"
            >
              View All
            </button>
          }
        >
          {pendingUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mb-3">
                <UserCheck className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No pending approvals</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">All user registrations have been reviewed</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {pendingUsers.slice(0, 6).map((reg) => (
                <div
                  key={reg.id}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-[var(--color-surface-alt)] rounded px-2 -mx-2 transition-colors"
                  onClick={() => navigate('/coordinator/approvals')}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-900)] truncate">{reg.name}</p>
                    <p className="text-xs text-[var(--color-text-600)] capitalize">{reg.accountType}{reg.course ? ` · ${reg.course}` : ''}</p>
                  </div>
                  <span className="ml-3 shrink-0 px-2 py-0.5 rounded-full text-xs font-medium !bg-white border-[1.5px] border-amber-400 text-amber-700">
                    Pending
                  </span>
                </div>
              ))}
              {pendingUsers.length > 6 && (
                <p className="text-xs text-[var(--color-text-500)] pt-3 text-center">
                  +{pendingUsers.length - 6} more pending
                </p>
              )}
            </div>
          )}
        </DashboardCard>

        {/* Evaluation Progress */}
        <DashboardCard title="Evaluation Progress" icon={BarChart3}>
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

        {/* Upcoming Events */}
        <DashboardCard title="Upcoming Events" icon={CalendarDays}>
          {upcomingEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                <CalendarDays className="w-5 h-5 text-gray-400" />
              </div>
              <p className="text-sm font-medium text-[var(--color-text-900)]">No upcoming events</p>
              <p className="text-xs text-[var(--color-text-600)] mt-1">Upcoming milestones for your course will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${EVENT_CARD[event.color] ?? 'border-gray-300 bg-gray-50'} hover:shadow-sm transition-shadow`}
                >
                  <h3 className="text-sm font-semibold text-[var(--color-text-900)] mb-1 leading-snug">{event.title}</h3>
                  <p className="text-xs text-[var(--color-text-600)] mb-0.5">{event.date}</p>
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
