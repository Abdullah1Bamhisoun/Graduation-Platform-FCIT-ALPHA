import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { MetricCard } from '../../features/dashboard/components/MetricCard';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { mockSubmissions, mockWeeklyReports } from '../../lib/mock-data';
import { ClipboardList, Users, Calendar, Clock, FileText, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/AuthContext';

export function SupervisorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  const pendingReviews = mockSubmissions.filter(s => s.status === 'submitted' || s.status === 'under-review');
  const weeklyReportsToReview = mockWeeklyReports.filter(r => r.status === 'submitted');
  
  return (
    <Layout user={user} pageTitle="Supervisor Dashboard">
      {/* Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="Assigned Groups"
          value="3"
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
          value="2"
          icon={Calendar}
          color="success"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* To Review */}
        <DashboardCard
          title="Submissions to Review"
          icon={ClipboardList}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/supervisor/reviews')}
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
            {[
              { id: 1, name: 'Graduation Project Platform', students: 'Abdullah Bamhisoun, Abdulrahman Solymani', status: 'on-track' },
              { id: 2, name: 'Healthcare Management System', students: 'Khalid Al-Zahrani, Fahad Al-Shehri', status: 'attention' },
              { id: 3, name: 'E-Learning Platform', students: 'Omar Al-Ghamdi, Faisal Al-Qahtani', status: 'on-track' },
            ].map((group) => (
              <div key={group.id} className="p-4 rounded-lg !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] hover:border-[var(--color-primary-600)] transition-colors">
                <h3 className="text-[var(--color-text-900)] mb-2">{group.name}</h3>
                <p className="text-[var(--color-text-600)] mb-3">{group.students}</p>
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full ${
                    group.status === 'on-track' 
                      ? '!bg-white dark:bg-green-950/30 text-green-700 dark:text-green-400 border-[1.5px] border-green-500 dark:border-green-900/50' 
                      : '!bg-white dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-[1.5px] border-amber-500 dark:border-amber-900/50'
                  }`}>
                    {group.status === 'on-track' ? 'On Track' : 'Needs Attention'}
                  </span>
                  <Button variant="ghost" size="sm">View Details</Button>
                </div>
              </div>
            ))}
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
              onClick={() => navigate('/supervisor/reviews?tab=weekly')}
            >
              View All
            </Button>
          }
        >
          <div className="space-y-3">
            {mockWeeklyReports.map((report) => (
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
            ))}
          </div>
        </DashboardCard>

        {/* Upcoming Events */}
        <DashboardCard
          title="Upcoming Events"
          icon={Calendar}
        >
          <div className="space-y-4">
            <div className="p-4 !bg-white dark:bg-gray-800 border-[1.5px] border-blue-600 dark:border-blue-900/50 rounded-lg hover:bg-blue-50/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--color-text-900)]">Project Demos</h3>
                <span className="text-blue-600 dark:text-blue-400">Nov 15, 2025</span>
              </div>
              <p className="text-[var(--color-text-600)] mb-2">3 groups scheduled</p>
              <p className="text-[var(--color-text-600)]">Building 51, Lab 201</p>
            </div>

            <div className="p-4 !bg-white dark:bg-gray-800 border-[1.5px] border-purple-600 dark:border-purple-900/50 rounded-lg hover:bg-purple-50/30 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-[var(--color-text-900)]">Poster Presentations</h3>
                <span className="text-purple-600 dark:text-purple-400">Nov 20, 2025</span>
              </div>
              <p className="text-[var(--color-text-600)] mb-2">All groups</p>
              <p className="text-[var(--color-text-600)]">Building 51, Hall A</p>
            </div>

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
          className="col-span-2"
        >
          <div className="space-y-3">
            {[
              { type: 'submission', message: 'Abdullah Bamhisoun submitted Chapter 4', time: '2 hours ago', color: 'blue' },
              { type: 'report', message: 'Sara Ahmed submitted Weekly Report Week 9', time: '5 hours ago', color: 'green' },
              { type: 'comment', message: 'Mohammed Ali replied to your feedback', time: '1 day ago', color: 'purple' },
              { type: 'submission', message: 'Noura Hassan uploaded revised Chapter 3', time: '2 days ago', color: 'blue' },
            ].map((activity, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg hover:bg-[var(--color-surface-alt)] transition-colors">
                <div className={`w-2 h-2 rounded-full mt-2 bg-${activity.color}-500`}></div>
                <div className="flex-1">
                  <p className="text-[var(--color-text-900)]">{activity.message}</p>
                  <p className="text-[var(--color-text-600)]">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>
      </div>
    </Layout>
  );
}
