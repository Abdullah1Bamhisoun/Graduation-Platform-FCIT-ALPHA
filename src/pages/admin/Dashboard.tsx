import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { Button } from '../../components/ui/button';
import { Settings, Bell, BarChart3, Users, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
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

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<AdminStats>({ totalStudents: 0, overdueSubmissions: 0, upcomingDeadlines: 0, completedProjects: 0, completionRate: 0 });
  const [submissionVolume, setSubmissionVolume] = useState<SubmissionVolumeDay[]>([]);
  const [evalProgress, setEvalProgress] = useState<EvaluationProgress>({ courses: [], overallEvaluated: 0, overallTotal: 0, overallPercent: 0 });
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
  if (loading) return <Layout user={user} pageTitle="Admin Dashboard"><div className="p-6">Loading...</div></Layout>;

  const maxSubmissions = submissionVolume.length > 0 ? Math.max(...submissionVolume.map(d => d.count), 1) : 1;

  const eventColors: Record<string, string> = {
    blue: 'border-blue-500 dark:border-blue-900/50',
    purple: 'border-purple-500 dark:border-purple-900/50',
    green: 'border-green-500 dark:border-green-900/50',
    amber: 'border-amber-500 dark:border-amber-900/50',
  };
  const eventTextColors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <Layout user={user} pageTitle="Admin Dashboard">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="Total Students"
          value={stats.totalStudents}
          icon={Users}
          color="primary"
        />
        <MetricCard
          label="Overdue Submissions"
          value={stats.overdueSubmissions}
          icon={AlertTriangle}
          color="danger"
        />
        <MetricCard
          label="Upcoming Deadlines"
          value={stats.upcomingDeadlines}
          icon={Clock}
          color="warning"
        />
        <MetricCard
          label="Completed Projects"
          value={stats.completedProjects}
          icon={CheckCircle}
          trend={stats.completionRate > 0 ? { value: `${stats.completionRate}% completion rate`, positive: true } : undefined}
          color="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Quick Actions */}
        <DashboardCard
          title="Quick Actions"
          icon={Settings}
        >
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/milestones')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Configure Milestones
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/announcements')}
            >
              <Bell className="w-4 h-4 mr-2" />
              Create Announcement
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/exports')}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Export Reports
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/admin/users')}
            >
              <Users className="w-4 h-4 mr-2" />
              Manage Users
            </Button>
          </div>
        </DashboardCard>

        {/* Submission Volume */}
        <DashboardCard
          title="Submission Volume (Last 7 Days)"
          icon={FileText}
        >
          <div className="space-y-4">
            {submissionVolume.map((data) => (
              <div key={data.day} className="flex items-center gap-4">
                <span className="w-24 text-[var(--color-text-600)]">{data.day}</span>
                <div className="flex-1 !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-6">
                  <div
                    className="bg-[var(--color-primary-600)] h-full rounded-full flex items-center justify-end px-3 text-white"
                    style={{ width: `${(data.count / maxSubmissions) * 100}%` }}
                  >
                    {data.count > 0 && data.count}
                  </div>
                </div>
              </div>
            ))}
            {submissionVolume.length === 0 && (
              <p className="text-center text-[var(--color-text-600)] py-4">No submissions this week</p>
            )}
          </div>
        </DashboardCard>

        {/* Evaluation Progress */}
        <DashboardCard
          title="Evaluation Progress by Course"
          icon={BarChart3}
        >
          <div className="space-y-6">
            {evalProgress.courses.map((c) => (
              <div key={c.course}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[var(--color-text-900)]">{c.course}</span>
                  <span className="text-[var(--color-text-600)]">{c.evaluated}/{c.total} ({c.percent}%)</span>
                </div>
                <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-3">
                  <div
                    className="bg-green-500 h-full rounded-full"
                    style={{ width: `${c.percent}%` }}
                  ></div>
                </div>
              </div>
            ))}

            {evalProgress.overallTotal > 0 && (
              <div className="pt-4 border-t border-[var(--color-border)]">
                <p className="text-[var(--color-text-600)] mb-2">
                  Overall evaluation completion rate
                </p>
                <div className="text-center p-4 bg-white border border-green-500 rounded-lg">
                  <p className="text-green-900">{evalProgress.overallPercent}%</p>
                  <p className="text-green-700">{evalProgress.overallEvaluated}/{evalProgress.overallTotal} evaluations completed</p>
                </div>
              </div>
            )}

            {evalProgress.courses.length === 0 && (
              <p className="text-center text-[var(--color-text-600)] py-4">No evaluation data available</p>
            )}
          </div>
        </DashboardCard>

        {/* Recent Activity */}
        <DashboardCard
          title="System Activity"
          icon={Clock}
        >
          <div className="space-y-3">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 bg-${activity.color}-500`}></div>
                <div className="flex-1">
                  <p className="text-[var(--color-text-900)]">{activity.message}</p>
                  <p className="text-[var(--color-text-600)]">{activity.time}</p>
                </div>
              </div>
            ))}
            {recentActivity.length === 0 && (
              <p className="text-center text-[var(--color-text-600)] py-4">No recent activity</p>
            )}
          </div>
        </DashboardCard>

        {/* Upcoming Events */}
        <DashboardCard
          title="Upcoming Events"
          className="col-span-2"
        >
          {upcomingEvents.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {upcomingEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-4 !bg-white dark:bg-gray-800 border-[1.5px] ${eventColors[event.color]} rounded-lg hover:opacity-90 transition-colors`}
                >
                  <h3 className="text-[var(--color-text-900)] mb-2">{event.title}</h3>
                  <p className="text-[var(--color-text-600)] mb-1">{event.date}</p>
                  <p className={eventTextColors[event.color]}>{event.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[var(--color-text-600)] py-4">No upcoming events</p>
          )}
        </DashboardCard>
      </div>
    </Layout>
  );
}
