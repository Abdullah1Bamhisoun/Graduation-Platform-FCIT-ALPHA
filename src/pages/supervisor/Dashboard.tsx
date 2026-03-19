import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { getSubmissionsForSupervisor } from '../../services/submissions';
import { getWeeklyReportsForSupervisor } from '../../services/weekly-reports';
import { getGroupsForSupervisor } from '../../services/groups';
import { getUpcomingEvents, timeAgo } from '../../services/dashboard';
import type { UpcomingEvent } from '../../services/dashboard';
import type { GroupData } from '../../services/groups';
import { ClipboardList, Users, Calendar, Clock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import type { Submission, WeeklyReport } from '../../types';

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSubmissionsForSupervisor(user.id),
      getWeeklyReportsForSupervisor(user.id),
      getGroupsForSupervisor(user.id),
      getUpcomingEvents(3),
    ]).then(([subs, reports, grps, events]) => {
      setSubmissions(subs);
      setWeeklyReports(reports);
      setGroups(grps);
      setUpcomingEvents(events);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Supervisor Dashboard"><div className="p-6">Loading...</div></Layout>;

  const pendingReviews = submissions.filter(s => s.status === 'submitted' || s.status === 'under-review');
  const weeklyReportsToReview = weeklyReports.filter(r => r.status === 'submitted');

  const getGroupStatus = (group: GroupData) => {
    const memberIds = new Set(group.members.map(m => m.id));
    return submissions.some(s => memberIds.has(s.studentId) && s.status === 'changes-requested')
      ? 'attention'
      : 'on-track';
  };

  const recentActivity = [...submissions]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 4)
    .map(s => ({
      id: s.id,
      message: `${s.studentName} submitted ${s.milestoneName}`,
      time: timeAgo(s.submittedAt),
      color: s.status === 'changes-requested' ? 'red' : 'blue',
    }));

  const eventColors: Record<string, string> = {
    blue: 'border-blue-600 dark:border-blue-900/50',
    purple: 'border-purple-600 dark:border-purple-900/50',
    green: 'border-green-600 dark:border-green-900/50',
    amber: 'border-amber-600 dark:border-amber-900/50',
    red: 'border-red-600 dark:border-red-900/50',
  };
  const eventTextColors: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400',
    purple: 'text-purple-600 dark:text-purple-400',
    green: 'text-green-600 dark:text-green-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  };

  return (
    <Layout user={user} pageTitle="Supervisor Dashboard">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          label="Assigned Groups"
          value={groups.length}
          icon={Users}
          color="primary"
        />
        <MetricCard
          label="Pending Reviews"
          value={pendingReviews.length}
          icon={ClipboardList}
          color="warning"
        />
        <MetricCard
          label="Weekly Reports"
          value={weeklyReportsToReview.length}
          icon={FileText}
          color="info"
        />
        <MetricCard
          label="Upcoming Events"
          value={upcomingEvents.length}
          icon={Calendar}
          color="success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* To Review */}
        <DashboardCard
          title="Submissions to Review"
          icon={ClipboardList}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/supervisor/groups')}
            >
              View All
            </Button>
          }
        >
          <div className="space-y-4">
            {pendingReviews.length > 0 ? (
              pendingReviews.map((submission) => (
                <div
                  key={submission.id}
                  className="flex items-center justify-between p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/supervisor/review/${submission.id}`)}
                >
                  <div className="flex-1">
                    <h3 className="text-[var(--color-text-900)] mb-1">{submission.projectName}</h3>
                    <p className="text-[var(--color-text-600)] mb-2">{submission.milestoneName}</p>
                    <div className="flex items-center gap-2 text-[var(--color-text-600)]">
                      <Clock className="w-4 h-4" />
                      <span>Submitted {new Date(submission.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/supervisor/review/${submission.id}`);
                    }}
                  >
                    Review
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No submissions to review</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Assigned Groups */}
        <DashboardCard
          title="My Groups"
          icon={Users}
        >
          <div className="space-y-4">
            {groups.length > 0 ? (
              groups.map((group) => {
                const status = getGroupStatus(group);
                return (
                  <div key={group.id} className="p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] transition-colors">
                    <h3 className="text-[var(--color-text-900)] mb-2">{group.projectName}</h3>
                    <p className="text-[var(--color-text-600)] mb-3">{group.members.map(m => m.name).join(', ')}</p>
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full ${
                        status === 'on-track'
                          ? '!bg-white dark:bg-green-950/30 text-green-700 dark:text-green-400 border-[1.5px] border-green-500 dark:border-green-900/50'
                          : '!bg-white dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-[1.5px] border-amber-500 dark:border-amber-900/50'
                      }`}>
                        {status === 'on-track' ? 'On Track' : 'Needs Attention'}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/supervisor/groups?tab=groups-grades')}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No groups assigned</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Weekly Reports */}
        <DashboardCard
          title="Weekly Reports to Review"
          icon={FileText}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/supervisor/weekly-reports')}
            >
              View All
            </Button>
          }
        >
          <div className="space-y-3">
            {weeklyReports.length > 0 ? (
              weeklyReports.map((report) => (
                <div
                  key={report.id}
                  className="p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/supervisor/weekly-report/${report.id}`)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[var(--color-text-900)]">Week {report.weekNumber} Report</h3>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-[var(--color-text-600)] mb-2">{report.dateRange}</p>
                  <p className="text-[var(--color-text-600)]">
                    Submitted {report.submittedAt && new Date(report.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No weekly reports to review</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Upcoming Events */}
        <DashboardCard
          title="Upcoming Events"
          icon={Calendar}
        >
          <div className="space-y-4">
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((event, index) => (
                <div
                  key={index}
                  className={`p-4 !bg-white dark:bg-gray-800 border-[1.5px] ${eventColors[event.color]} rounded-lg hover:opacity-90 transition-colors`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[var(--color-text-900)]">{event.title}</h3>
                    <span className={eventTextColors[event.color]}>{event.date}</span>
                  </div>
                  <p className="text-[var(--color-text-600)]">{event.detail}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-[var(--color-text-600)] py-4">No upcoming events</p>
            )}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/supervisor/schedule')}
            >
              <Calendar className="w-4 h-4 mr-2" />
              View Full Schedule
            </Button>
          </div>
        </DashboardCard>

        {/* Recent Activity */}
        <DashboardCard
          title="Recent Activity"
          icon={Clock}
          className="lg:col-span-2"
        >
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors">
                  <div className={`w-2 h-2 rounded-full mt-2 bg-${activity.color}-500`}></div>
                  <div className="flex-1">
                    <p className="text-[var(--color-text-900)]">{activity.message}</p>
                    <p className="text-[var(--color-text-600)]">{activity.time}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-[var(--color-text-600)] py-4">No recent activity</p>
            )}
          </div>
        </DashboardCard>
      </div>
    </Layout>
  );
}
