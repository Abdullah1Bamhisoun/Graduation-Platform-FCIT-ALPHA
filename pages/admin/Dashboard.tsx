import { Layout } from '../../components/Layout';
import { DashboardCard } from '../../components/DashboardCard';
import { MetricCard } from '../../components/MetricCard';
import { Button } from '../../components/ui/button';
import { mockUsers } from '../../lib/mock-data';
import { Settings, Bell, BarChart3, Users, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function AdminDashboard() {
  const navigate = useNavigate();
  const user = mockUsers.admin;

  return (
    <Layout user={user} pageTitle="Admin Dashboard">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <MetricCard
          label="Total Students"
          value="156"
          icon={Users}
          trend={{ value: '+12 from last term', positive: true }}
          color="primary"
        />
        <MetricCard
          label="Overdue Submissions"
          value="8"
          icon={AlertTriangle}
          color="danger"
        />
        <MetricCard
          label="Upcoming Deadlines"
          value="3"
          icon={Clock}
          color="warning"
        />
        <MetricCard
          label="Completed Projects"
          value="142"
          icon={CheckCircle}
          trend={{ value: '91% completion rate', positive: true }}
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
            {[
              { day: 'Monday', count: 12 },
              { day: 'Tuesday', count: 18 },
              { day: 'Wednesday', count: 24 },
              { day: 'Thursday', count: 15 },
              { day: 'Friday', count: 21 },
              { day: 'Saturday', count: 8 },
              { day: 'Sunday', count: 5 },
            ].map((data) => (
              <div key={data.day} className="flex items-center gap-4">
                <span className="w-24 text-[var(--color-text-600)]">{data.day}</span>
                <div className="flex-1 !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-6">
                  <div
                    className="bg-[var(--color-primary-600)] h-full rounded-full flex items-center justify-end px-3 text-white"
                    style={{ width: `${(data.count / 24) * 100}%` }}
                  >
                    {data.count}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DashboardCard>

        {/* Evaluation Progress */}
        <DashboardCard
          title="Evaluation Progress by Course"
          icon={BarChart3}
        >
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-900)]">CPIS-498</span>
                <span className="text-[var(--color-text-600)]">78/85 (92%)</span>
              </div>
              <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-3">
                <div
                  className="bg-green-500 h-full rounded-full"
                  style={{ width: '92%' }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[var(--color-text-900)]">CPIS-499</span>
                <span className="text-[var(--color-text-600)]">64/71 (90%)</span>
              </div>
              <div className="w-full !bg-white dark:bg-gray-800 border-[1.5px] border-[var(--color-border)] rounded-full h-3">
                <div
                  className="bg-green-500 h-full rounded-full"
                  style={{ width: '90%' }}
                ></div>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--color-border)]">
              <p className="text-[var(--color-text-600)] mb-2">
                Overall evaluation completion rate
              </p>
              <div className="text-center p-4 bg-white border border-green-500 rounded-lg">
                <p className="text-green-900">91%</p>
                <p className="text-green-700">142/156 evaluations completed</p>
              </div>
            </div>
          </div>
        </DashboardCard>

        {/* Recent Activity */}
        <DashboardCard
          title="System Activity"
          icon={Clock}
        >
          <div className="space-y-3">
            {[
              { message: 'Milestone "Final Report" deadline updated', time: '10 minutes ago', color: 'blue' },
              { message: 'New announcement published to all students', time: '2 hours ago', color: 'green' },
              { message: '12 submissions received for Chapter 4', time: '5 hours ago', color: 'purple' },
              { message: 'Exported grade reports for CPIS-498', time: '1 day ago', color: 'amber' },
              { message: 'Supervisor Dr. Ahmad added to system', time: '2 days ago', color: 'gray' },
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

        {/* Upcoming Events */}
        <DashboardCard
          title="Upcoming Events"
          className="col-span-2"
        >
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 !bg-white dark:bg-gray-800 border-[1.5px] border-blue-500 dark:border-blue-900/50 rounded-lg hover:bg-blue-50/30 transition-colors">
              <h3 className="text-[var(--color-text-900)] mb-2">Project Demos</h3>
              <p className="text-[var(--color-text-600)] mb-1">Nov 15, 2025</p>
              <p className="text-blue-600 dark:text-blue-400">45 groups scheduled</p>
            </div>
            <div className="p-4 !bg-white dark:bg-gray-800 border-[1.5px] border-purple-500 dark:border-purple-900/50 rounded-lg hover:bg-purple-50/30 transition-colors">
              <h3 className="text-[var(--color-text-900)] mb-2">Poster Presentations</h3>
              <p className="text-[var(--color-text-600)] mb-1">Nov 20, 2025</p>
              <p className="text-purple-600 dark:text-purple-400">All groups (156 students)</p>
            </div>
            <div className="p-4 !bg-white dark:bg-gray-800 border-[1.5px] border-green-500 dark:border-green-900/50 rounded-lg hover:bg-green-50/30 transition-colors">
              <h3 className="text-[var(--color-text-900)] mb-2">Final Grades Due</h3>
              <p className="text-[var(--color-text-600)] mb-1">Nov 30, 2025</p>
              <p className="text-green-600 dark:text-green-400">CPIS-498 & CPIS-499</p>
            </div>
          </div>
        </DashboardCard>
      </div>
    </Layout>
  );
}
