import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { getMilestonesByStudentWithStatus } from '../../services/milestones';
import { getNotificationsForUser } from '../../services/notifications';
import { Calendar, AlertCircle, CheckCircle, Clock, FileText, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import type { Milestone, Notification } from '../../types';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMilestonesByStudentWithStatus(user.id),
      getNotificationsForUser(user.id),
    ]).then(([m, n]) => {
      setMilestones(m);
      setNotifications(n);
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

  return (
    <Layout user={user} pageTitle="Dashboard" unreadCount={notifications.filter(n => !n.read).length}>
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
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
          value="1"
          icon={FileText}
          color="primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
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
                  className="p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-amber-600 dark:border-amber-900/50 hover:bg-amber-50/30 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-[var(--color-text-900)]">{milestone.name}</h3>
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
                {Math.round((approvedCount / totalMilestones) * 100)}%
              </span>
            </div>
            <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-2.5">
              <div
                className="bg-[var(--color-primary-600)] h-full rounded-full"
                style={{ width: `${(approvedCount / totalMilestones) * 100}%` }}
              ></div>
            </div>

            <div className="mt-6 space-y-2">
              {milestones.slice(0, 5).map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between py-2 cursor-pointer hover:bg-[var(--color-surface-alt)] rounded px-2"
                  onClick={() => navigate(`/student/submissions/${milestone.id}`)}
                >
                  <span className="text-[var(--color-text-900)]">{milestone.name}</span>
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
              View Grades
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

          <div className="mt-6 p-4 !bg-white dark:bg-gray-800 rounded-lg border-[1.5px] border-blue-500 dark:border-blue-900/50 hover:bg-blue-50/30 transition-colors">
            <h3 className="text-[var(--color-text-900)] mb-2">Upcoming Event</h3>
            <p className="text-[var(--color-text-600)] mb-1">Poster Presentation</p>
            <p className="text-blue-600 dark:text-blue-400">Nov 20, 2025 • Building 51, Hall A</p>
          </div>
        </DashboardCard>
      </div>
    </Layout>
  );
}
