import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { getMilestonesByStudentWithStatus } from '../../services/milestones';
import { getNotificationsForUser } from '../../services/notifications';
import { getUpcomingEvents } from '../../services/dashboard';
import { getGroupForStudent, type GroupData } from '../../services/groups';
import type { UpcomingEvent } from '../../services/dashboard';
import { Calendar, AlertCircle, CheckCircle, Clock, FileText, Upload, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import type { Milestone, Notification } from '../../types';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMilestonesByStudentWithStatus(user.id),
      getNotificationsForUser(user.id),
      getUpcomingEvents(1),
      getGroupForStudent(user.id),
    ]).then(([m, n, events, g]) => {
      setMilestones(m);
      setNotifications(n);
      setUpcomingEvents(events);
      setGroup(g);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Dashboard"><div className="p-6">Loading...</div></Layout>;

  const upcomingDeadlines = milestones
    .filter(m => ['submitted', 'draft', 'changes-requested'].includes(m.status))
    .slice(0, 4);

  const pendingActions = milestones.filter(m => m.status === 'changes-requested');
  const approvedCount = milestones.filter(m => m.status === 'approved').length;
  const totalMilestones = milestones.length;
  const unreadFeedback = notifications.filter(n => !n.read && n.type === 'feedback').length;

  const nextEvent = upcomingEvents[0];
  const eventTextColor: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
  };
  const eventBorderColor: Record<string, string> = {
    blue: 'border-blue-500 dark:border-blue-900/50',
    purple: 'border-purple-500 dark:border-purple-900/50',
    green: 'border-green-500 dark:border-green-900/50',
    amber: 'border-amber-500 dark:border-amber-900/50',
  };

  return (
    <Layout user={user} pageTitle="Dashboard" unreadCount={notifications.filter(n => !n.read).length}>
      {/* Group Info Header */}
      {group && (
        <div className="!bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-600)]">Group</p>
              <p className="font-semibold text-[var(--color-text-900)] break-all text-sm">
                {group.groupCode}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-600)]">Project</p>
              <p className="font-semibold text-[var(--color-text-900)] break-words">{group.projectName || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--color-text-600)]">Teammates</p>
              {(() => {
                const teammates = group.members.filter((m) => m.id !== user.id).slice(0, 2);
                return teammates.length > 0 ? (
                  <div className="space-y-0.5">
                    {teammates.map((t) => (
                      <p key={t.id} className="font-semibold text-[var(--color-text-900)] truncate">{t.name || '—'}</p>
                    ))}
                  </div>
                ) : (
                  <p className="font-semibold text-[var(--color-text-500)]">None yet</p>
                );
              })()}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-[var(--color-text-600)]">Supervisor</p>
              <p className="font-semibold text-[var(--color-text-900)]">
                {group.supervisorName || 'Not assigned yet'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Completed Milestones"
          value={`${approvedCount}/${totalMilestones}`}
          icon={CheckCircle}
          color="success"
        />
        <MetricCard
          label="Pending Actions"
          value={pendingActions.length}
          icon={AlertCircle}
          color="warning"
        />
        <MetricCard
          label="Upcoming Deadlines"
          value={upcomingDeadlines.length}
          icon={Clock}
          color="info"
        />
        <MetricCard
          label="Unread Feedback"
          value={unreadFeedback}
          icon={FileText}
          color="primary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Deadlines */}
        <DashboardCard
          title="My Deadlines"
          icon={Calendar}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/student/milestones')}
            >
              View All
            </Button>
          }
        >
          <div className="space-y-4">
            {upcomingDeadlines.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center justify-between p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] cursor-pointer transition-colors"
                onClick={() => navigate('/student/milestones')}
              >
                <div className="flex-1">
                  <h3 className="text-[var(--color-text-900)] mb-1">{milestone.name}</h3>
                  <p className="text-[var(--color-text-600)]">
                    Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <StatusBadge status={milestone.status} />
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Pending Actions */}
        <DashboardCard
          title="Pending Actions"
          icon={AlertCircle}
        >
          {pendingActions.length > 0 ? (
            <div className="space-y-4">
              {pendingActions.map((milestone) => (
                <div
                  key={milestone.id}
                  className="p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-red-500 dark:border-red-900/50 hover:bg-red-50/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h3 className="text-[var(--color-text-900)] min-w-0">{milestone.name}</h3>
                    <StatusBadge status={milestone.status} />
                  </div>
                  <p className="text-[var(--color-text-600)] mb-3">
                    Feedback received. Please address the requested changes.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                  >
                    View Feedback
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-600)]">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No pending actions. Great job!</p>
            </div>
          )}
        </DashboardCard>

        {/* Progress Snapshot */}
        <DashboardCard
          title="Progress Snapshot"
          icon={CheckCircle}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--color-text-600)]">Overall Progress</span>
              <span className="text-[var(--color-text-900)]">
                {totalMilestones > 0 ? Math.round((approvedCount / totalMilestones) * 100) : 0}%
              </span>
            </div>
            <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-2.5">
              <div
                className="bg-[var(--color-primary-600)] h-full rounded-full"
                style={{ width: `${totalMilestones > 0 ? (approvedCount / totalMilestones) * 100 : 0}%` }}
              ></div>
            </div>

            <div className="mt-6 space-y-2">
              {milestones.slice(0, 5).map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between gap-3 py-2 cursor-pointer hover:bg-[var(--color-surface-alt)] rounded px-2"
                  onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                >
                  <span className="text-[var(--color-text-900)] min-w-0 truncate">{milestone.name}</span>
                  <StatusBadge status={milestone.status} />
                </div>
              ))}
            </div>
          </div>
        </DashboardCard>

        {/* Quick Actions */}
        <DashboardCard
          title="Quick Actions"
        >
          <div className="space-y-3">
            <Button
              className="w-full justify-start"
              onClick={() => navigate('/student/weekly-reports')}
            >
              <FileText className="w-4 h-4 mr-2" />
              New Weekly Report
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/student/milestones')}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Chapter
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/student/feedback')}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              My Grades
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => navigate('/student/calendar')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              View Calendar
            </Button>
          </div>

          {nextEvent && (
            <div className={`mt-6 p-4 !bg-white dark:bg-gray-800 rounded-lg border-[1.5px] ${eventBorderColor[nextEvent.color]} hover:opacity-90 transition-colors`}>
              <h3 className="text-[var(--color-text-900)] mb-2">Upcoming Event</h3>
              <p className="text-[var(--color-text-600)] mb-1">{nextEvent.title}</p>
              <p className={eventTextColor[nextEvent.color]}>{nextEvent.date} • {nextEvent.detail}</p>
            </div>
          )}
        </DashboardCard>
      </div>
    </Layout>
  );
}
