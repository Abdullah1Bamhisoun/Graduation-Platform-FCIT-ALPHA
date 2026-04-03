import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';

import { Button } from '../../components/ui/button';
import { getSubmissionsForSupervisor } from '../../services/submissions';
import { getGroupsForSupervisor } from '../../services/groups';
import { getWeeklyReportsForSupervisor } from '../../services/weekly-reports';
import { timeAgo } from '../../services/dashboard';
import type { GroupData } from '../../services/groups';
import { ClipboardList, Users, Clock, FileText, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';
import { useState, useEffect } from 'react';
import type { Submission, WeeklyReport } from '../../types';

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSubmissionsForSupervisor(user.id),
      getGroupsForSupervisor(user.id),
      getWeeklyReportsForSupervisor(user.id),
    ]).then(([subs, grps, reports]) => {
      setSubmissions(subs);
      setGroups(grps);
      setWeeklyReports(reports);
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Supervisor Dashboard"><div className="p-6">Loading...</div></Layout>;

  const pendingReviews = submissions.filter(s => s.status === 'submitted' || s.status === 'under-review');

  const unrespondedReports = weeklyReports.filter(
    r => r.submissionStatus === 'submitted' && r.supervisorResponseStatus === 'pending'
  );

  const pendingFeedbackItems = [
    ...pendingReviews.map(s => ({
      id: s.id,
      kind: 'submission' as const,
      title: s.projectName,
      subtitle: s.milestoneName,
      date: s.submittedAt,
      navigateTo: `/supervisor/review/${s.id}`,
    })),
    ...unrespondedReports.map(r => ({
      id: r.id,
      kind: 'report' as const,
      title: `Week ${r.weekNumber} Report`,
      subtitle: r.dateRange,
      date: r.submittedAt ?? '',
      navigateTo: `/supervisor/weekly-report/${r.id}`,
    })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const recentActivity = [...submissions]
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 4)
    .map(s => ({
      id: s.id,
      message: `${s.studentName} submitted ${s.milestoneName}`,
      time: timeAgo(s.submittedAt),
      color: s.status === 'changes-requested' ? 'red' : 'blue',
    }));

  return (
    <Layout user={user} pageTitle="Supervisor Dashboard">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
        <MetricCard
          label="Assigned Groups"
          value={groups.length}
          icon={Users}
          color="primary"
        />
        <MetricCard
          label="Pending Feedback"
          value={pendingFeedbackItems.length}
          icon={MessageSquare}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Submissions to Review */}
        <DashboardCard
          title="Submissions to Review"
          icon={ClipboardList}
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/supervisor/groups')}>
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
                    onClick={(e) => { e.stopPropagation(); navigate(`/supervisor/review/${submission.id}`); }}
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

        {/* Weekly Reports — awaiting response */}
        <DashboardCard
          title="Weekly Reports to Respond"
          icon={FileText}
          actions={
            <Button variant="ghost" size="sm" onClick={() => navigate('/supervisor/weekly-reports')}>
              View All
            </Button>
          }
        >
          <div className="space-y-3">
            {unrespondedReports.length > 0 ? (
              unrespondedReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] cursor-pointer transition-colors"
                  onClick={() => navigate(`/supervisor/weekly-report/${report.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[var(--color-text-900)] mb-0.5">Week {report.weekNumber} Report</h3>
                    <p className="text-sm text-[var(--color-text-600)] truncate">{report.dateRange}</p>
                    {report.submittedAt && (
                      <p className="text-xs text-[var(--color-text-500)] mt-0.5">
                        Submitted {new Date(report.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate(`/supervisor/weekly-report/${report.id}`); }}
                  >
                    Respond
                  </Button>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-[var(--color-text-600)]">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>All weekly reports have been responded to</p>
              </div>
            )}
          </div>
        </DashboardCard>

        {/* Recent Activity */}
        <DashboardCard title="Recent Activity" icon={Clock} className="lg:col-span-2">
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
