import { Layout } from '../../components/layout/Layout';
import { DashboardCard } from '../../features/dashboard/components/DashboardCard';
import { Button } from '../../components/ui/button';
import { mockUsers } from '../../lib/mock-data';
import { Users, Clock, CheckCircle, AlertTriangle, Calendar, FileText } from 'lucide-react';
import { useState } from 'react';

interface Group {
  id: string;
  groupNumber: number;
  course: string;
  year: number;
  term: string;
  section: string;
  students: {
    id: string;
    name: string;
    email: string;
  }[];
  projectTitle: string;
  status: 'on-track' | 'needs-attention' | 'at-risk';
  lastSubmission: string;
  upcomingDeadline: string;
  completedMilestones: number;
  totalMilestones: number;
  weeklyReportsSubmitted: number;
  totalWeeklyReports: number;
}

const mockGroups: Group[] = [
  {
    id: '13_498_2026_01_M',
    groupNumber: 13,
    course: 'CPIS-498',
    year: 2026,
    term: '01',
    section: 'M',
    students: [
      { id: '2236500', name: 'Abdullah Bamhisoun', email: 'abdullah.b@stu.kau.edu.sa' },
      { id: '2236501', name: 'Abdulrahman Solymani', email: 'abdulrahman.s@stu.kau.edu.sa' },
    ],
    projectTitle: 'Graduation Project Platform',
    status: 'on-track',
    lastSubmission: 'Chapter 3 - Methodology',
    upcomingDeadline: 'Final Report - Nov 10, 2025',
    completedMilestones: 5,
    totalMilestones: 8,
    weeklyReportsSubmitted: 9,
    totalWeeklyReports: 9,
  },
  {
    id: '07_498_2026_01_M',
    groupNumber: 7,
    course: 'CPIS-498',
    year: 2026,
    term: '01',
    section: 'M',
    students: [
      { id: '2236789', name: 'Bandar Al-Juhani', email: 'bandar.j@stu.kau.edu.sa' },
      { id: '2236790', name: 'Rayan Al-Malki', email: 'rayan.m@stu.kau.edu.sa' },
    ],
    projectTitle: 'AI-Powered Learning Assistant',
    status: 'needs-attention',
    lastSubmission: 'Chapter 2 - Literature Review',
    upcomingDeadline: 'Chapter 3 - Nov 15, 2025',
    completedMilestones: 4,
    totalMilestones: 8,
    weeklyReportsSubmitted: 8,
    totalWeeklyReports: 9,
  },
  {
    id: '22_499_2026_02_M',
    groupNumber: 22,
    course: 'CPIS-499',
    year: 2026,
    term: '02',
    section: 'M',
    students: [
      { id: '2235123', name: 'Abdullah Bamhisoun', email: 'abdullah.b@stu.kau.edu.sa' },
      { id: '2235124', name: 'Abdulrahman Solymani', email: 'abdulrahman.s@stu.kau.edu.sa' },
    ],
    projectTitle: 'Smart Campus Navigation System',
    status: 'on-track',
    lastSubmission: 'Chapter 4 - Implementation',
    upcomingDeadline: 'Final Report - Nov 10, 2025',
    completedMilestones: 6,
    totalMilestones: 8,
    weeklyReportsSubmitted: 10,
    totalWeeklyReports: 10,
  },
];

export function SupervisorMyGroups() {
  const user = mockUsers.supervisor;
  const [selectedCourse, setSelectedCourse] = useState<string>('all');

  const filteredGroups = selectedCourse === 'all' 
    ? mockGroups 
    : mockGroups.filter(g => g.course === selectedCourse);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'on-track':
        return '!bg-white text-green-700 border border-green-500 border-[1.5px]';
      case 'needs-attention':
        return '!bg-white text-amber-700 border border-amber-500 border-[1.5px]';
      case 'at-risk':
        return '!bg-white text-red-700 border border-red-500 border-[1.5px]';
      default:
        return '!bg-white text-gray-700 border border-gray-400 border-[1.5px]';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'on-track':
        return 'On Track';
      case 'needs-attention':
        return 'Needs Attention';
      case 'at-risk':
        return 'At Risk';
      default:
        return 'Unknown';
    }
  };

  return (
    <Layout user={user} pageTitle="My Groups">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[var(--color-text-600)] mb-2">Total Groups</p>
              <p className="text-[var(--color-text-900)]">{mockGroups.length}</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-white border border-purple-500 text-purple-700 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[var(--color-text-600)] mb-2">On Track</p>
              <p className="text-[var(--color-text-900)]">
                {mockGroups.filter(g => g.status === 'on-track').length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-white border border-green-500 text-green-700 flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[var(--color-text-600)] mb-2">Needs Attention</p>
              <p className="text-[var(--color-text-900)]">
                {mockGroups.filter(g => g.status === 'needs-attention').length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-white border border-amber-500 text-amber-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-[var(--color-text-600)] mb-2">At Risk</p>
              <p className="text-[var(--color-text-900)]">
                {mockGroups.filter(g => g.status === 'at-risk').length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-white border border-red-500 text-red-700 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-3">
        <Button
          variant={selectedCourse === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCourse('all')}
          className="text-black"
        >
          All Courses
        </Button>
        <Button
          variant={selectedCourse === 'CPIS-498' ? 'default' : 'outline'}
          onClick={() => setSelectedCourse('CPIS-498')}
          className="text-black"
        >
          CPIS-498
        </Button>
        <Button
          variant={selectedCourse === 'CPIS-499' ? 'default' : 'outline'}
          onClick={() => setSelectedCourse('CPIS-499')}
          className="text-black"
        >
          CPIS-499
        </Button>
      </div>

      {/* Groups List */}
      <div className="space-y-6">
        {filteredGroups.map((group) => (
          <DashboardCard
            key={group.id}
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                  <span>Group {group.groupNumber} - {group.course}</span>
                  <span className="text-[var(--color-text-600)]">({group.id})</span>
                </div>
                <span className={`px-3 py-1 rounded-full ${getStatusColor(group.status)}`}>
                  {getStatusLabel(group.status)}
                </span>
              </div>
            }
            icon={Users}
          >
            <div className="space-y-4">
              {/* Project Title */}
              <div>
                <p className="text-[var(--color-text-600)] mb-1">Project Title</p>
                <h3 className="text-[var(--color-text-900)]">{group.projectTitle}</h3>
              </div>

              {/* Students */}
              <div>
                <p className="text-[var(--color-text-600)] mb-2">Team Members</p>
                <div className="space-y-2">
                  {group.students.map((student) => (
                    <div key={student.id} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[var(--color-primary-100)] flex items-center justify-center">
                        <span className="text-[var(--color-primary-700)]">
                          {student.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div>
                        <p className="text-[var(--color-text-900)]">{student.name}</p>
                        <p className="text-[var(--color-text-600)]">{student.id} • {student.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress Stats */}
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-border)]">
                <div>
                  <div className="flex items-center gap-2 text-[var(--color-text-600)] mb-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>Milestones</span>
                  </div>
                  <p className="text-[var(--color-text-900)]">
                    {group.completedMilestones}/{group.totalMilestones}
                    <span className="text-[var(--color-text-600)] ml-2">
                      ({Math.round((group.completedMilestones / group.totalMilestones) * 100)}%)
                    </span>
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-[var(--color-text-600)] mb-1">
                    <FileText className="w-4 h-4" />
                    <span>Weekly Reports</span>
                  </div>
                  <p className="text-[var(--color-text-900)]">
                    {group.weeklyReportsSubmitted}/{group.totalWeeklyReports}
                    <span className="text-[var(--color-text-600)] ml-2">
                      ({Math.round((group.weeklyReportsSubmitted / group.totalWeeklyReports) * 100)}%)
                    </span>
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-[var(--color-text-600)] mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Next Deadline</span>
                  </div>
                  <p className="text-[var(--color-text-900)]">{group.upcomingDeadline}</p>
                </div>
              </div>

              {/* Last Submission */}
              <div className="p-4 bg-white border border-blue-500 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 mb-1">
                  <Clock className="w-4 h-4" />
                  <span>Last Submission</span>
                </div>
                <p className="text-blue-800">{group.lastSubmission}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button className="text-black">
                  View Details
                </Button>
                <Button variant="outline" className="text-black">
                  View Submissions
                </Button>
                <Button variant="outline" className="text-black">
                  Contact Students
                </Button>
              </div>
            </div>
          </DashboardCard>
        ))}
      </div>
    </Layout>
  );
}
