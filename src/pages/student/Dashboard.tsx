import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { getMilestonesByStudentWithStatus } from '../../services/milestones';
import { getNotificationsForUser } from '../../services/notifications';
import { getUpcomingEvents } from '../../services/dashboard';
import { getGroupForStudent, type GroupData } from '../../services/groups';
import { getSubmissionsForStudent } from '../../services/submissions';
import { getWeeklyReportsByGroup } from '../../services/weekly-reports';
import type { UpcomingEvent } from '../../services/dashboard';
import { Calendar, CheckCircle, Clock, FileText, Users, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import type { Milestone, Notification, Submission, WeeklyReport } from '../../types';

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [_upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [group, setGroup] = useState<GroupData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getGroupForStudent(user.id).then(g => {
      setGroup(g);
      return Promise.all([
        getMilestonesByStudentWithStatus(user.id),
        getNotificationsForUser(user.id),
        getUpcomingEvents(1),
        getSubmissionsForStudent(user.id),
        g ? getWeeklyReportsByGroup(g.id) : Promise.resolve([]),
      ]);
    }).then(([m, n, events, subs, reports]) => {
      setMilestones(m);
      setNotifications(n);
      setUpcomingEvents(events);
      setSubmissions(subs);
      setWeeklyReports(reports);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Dashboard"><div className="p-6">Loading...</div></Layout>;

  const upcomingDeadlines = milestones
    .filter(m => ['submitted', 'draft', 'changes-requested'].includes(m.status))
    .slice(0, 4);

  const approvedCount = milestones.filter(m => m.status === 'approved').length;
  const totalMilestones = milestones.length;
  const unreadFeedback = notifications.filter(n => !n.read && n.type === 'feedback').length;

  // Combine submission feedback and weekly report supervisor replies, newest first, max 3
  type FeedbackItem =
    | { kind: 'submission'; title: string; comment: string; by: string; date: string; onClick: () => void }
    | { kind: 'weekly'; title: string; comment: string; by: string; date: string; onClick: () => void };

  const submissionFeedbackItems: FeedbackItem[] = submissions
    .filter(s => s.feedback)
    .map(s => ({
      kind: 'submission' as const,
      title: s.milestoneName,
      comment: s.feedback!.overallComment || 'No comment provided',
      by: s.feedback!.reviewedBy,
      date: s.feedback!.reviewedAt,
      onClick: () => navigate(`/student/submissions/${s.milestoneId}`),
    }));

  const weeklyFeedbackItems: FeedbackItem[] = weeklyReports
    .filter(r => r.supervisorResponseStatus === 'responded' && r.supervisorComments)
    .map(r => ({
      kind: 'weekly' as const,
      title: `Week ${r.weekNumber} Report`,
      comment: r.supervisorComments,
      by: r.reviewedBy || r.supervisorName || 'Supervisor',
      date: r.submittedAt || '',
      onClick: () => navigate('/student/weekly-reports'),
    }));

  const feedbackItems = [...submissionFeedbackItems, ...weeklyFeedbackItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <MetricCard
          label="Completed Milestones"
          value={`${approvedCount}/${totalMilestones}`}
          icon={CheckCircle}
          color="success"
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

      <div className="space-y-6">
        {/* My Deadlines — full width */}
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
          {upcomingDeadlines.length > 0 ? (
            <div className="space-y-3">
              {upcomingDeadlines.map((milestone) => (
                <div
                  key={milestone.id}
                  className="flex items-center justify-between p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] cursor-pointer transition-colors"
                  onClick={() => navigate('/student/milestones')}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="text-[var(--color-text-900)] mb-1 truncate">{milestone.name}</h3>
                    <p className="text-[var(--color-text-600)] text-sm">
                      Due: {new Date(milestone.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <StatusBadge status={milestone.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-600)]">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
              <p>No upcoming deadlines</p>
            </div>
          )}
        </DashboardCard>

        {/* Feedback Inbox — full width */}
        <DashboardCard
          title="Feedback Inbox"
          icon={MessageSquare}
        >
          {feedbackItems.length > 0 ? (
            <div className="divide-y divide-[var(--color-border)]">
              {feedbackItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-[var(--color-surface-alt)] rounded px-2 -mx-2 transition-colors"
                  onClick={item.onClick}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium text-[var(--color-text-900)] truncate">{item.title}</p>
                      {item.kind === 'weekly' && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex-shrink-0">Weekly</span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--color-text-600)] truncate">
                      {item.comment}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-[var(--color-text-700)]">{item.by}</p>
                    {item.date && (
                      <p className="text-xs text-[var(--color-text-500)] mt-0.5">
                        {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-600)]">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No feedback received yet</p>
            </div>
          )}
        </DashboardCard>
      </div>
    </Layout>
  );
}
