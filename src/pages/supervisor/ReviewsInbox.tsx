import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { mockUsers, mockSubmissions, mockWeeklyReports } from '../../lib/mock-data';
import { useNavigate } from 'react-router-dom';
import { Filter, FileText, Clock } from 'lucide-react';

// Mock groups data
const mockGroups = [
  { id: '13_498_2026_01_M', name: 'Group 13 - Smart Parking System', course: 'CPIS-498' as const, students: ['Abdullah Bamhisoun', 'Abdulrahman Solymani'] },
  { id: '14_498_2026_01_M', name: 'Group 14 - E-Learning Platform', course: 'CPIS-498' as const, students: ['Ahmed Ali', 'Mohammed Hassan'] },
  { id: '15_498_2026_01_M', name: 'Group 15 - Healthcare App', course: 'CPIS-498' as const, students: ['Sara Ibrahim', 'Fatima Omar'] },
];

export function SupervisorReviewsInbox() {
  const navigate = useNavigate();
  const user = mockUsers.supervisor;
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('');

  const currentGroup = mockGroups.find(g => g.id === selectedGroup);

  const submissions = mockSubmissions.filter(s => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    const matchesGroup = !selectedGroup || s.groupId === selectedGroup;
    return matchesStatus && matchesGroup;
  });

  return (
    <Layout user={user} pageTitle="Reviews Inbox">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Review student submissions and weekly reports
        </p>
      </div>

      {/* Group Selection */}
      <div className="mb-6 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-6">
        <div className="max-w-md">
          <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger id="group-select">
              <SelectValue placeholder="Choose a group to review" />
            </SelectTrigger>
            <SelectContent>
              {mockGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentGroup && (
            <p className="text-[var(--color-text-600)] mt-2">
              Students: {currentGroup.students.join(', ')}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
          <TabsTrigger value="weekly-reports">Weekly Reports ({mockWeeklyReports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions">
          {/* Filters */}
          <div className="mb-6 flex items-center gap-4">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <select
              className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="under-review">Under Review</option>
              <option value="changes-requested">Changes Requested</option>
              <option value="approved">Approved</option>
            </select>
            <select className="px-4 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)]">
              <option>All Courses</option>
              <option>CPIS-498</option>
              <option>CPIS-499</option>
            </select>
          </div>

          {/* Submissions Table */}
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--color-border)] text-[var(--color-text-600)]">
              <div className="col-span-3">Group / Project</div>
              <div className="col-span-3">Milestone</div>
              <div className="col-span-2">Submitted</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {submissions.map((submission) => (
                <div
                  key={submission.id}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-[var(--color-surface-alt)] transition-colors"
                >
                  <div className="col-span-3">
                    <h3 className="text-[var(--color-text-900)] mb-1">{submission.projectName}</h3>
                    <p className="text-[var(--color-text-600)]">{submission.studentName}</p>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <div>
                      <p className="text-[var(--color-text-900)] mb-1">{submission.milestoneName}</p>
                      <div className="flex items-center gap-2 text-[var(--color-text-600)]">
                        <FileText className="w-3 h-3" />
                        <span>Version {submission.currentVersion}</span>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <div className="flex items-center gap-2 text-[var(--color-text-600)]">
                      <Clock className="w-4 h-4" />
                      <span>{new Date(submission.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <StatusBadge status={submission.status} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/supervisor/review/${submission.id}`)}
                    >
                      {submission.status === 'submitted' || submission.status === 'under-review' ? 'Review' : 'View'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/supervisor/evaluation')}
                    >
                      Evaluate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weekly-reports">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-[var(--color-border)] text-[var(--color-text-600)]">
              <div className="col-span-3">Student</div>
              <div className="col-span-2">Week</div>
              <div className="col-span-3">Date Range</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {mockWeeklyReports.map((report) => (
                <div
                  key={report.id}
                  className="grid grid-cols-12 gap-4 p-4 hover:bg-[var(--color-surface-alt)] transition-colors"
                >
                  <div className="col-span-3 flex items-center">
                    <h3 className="text-[var(--color-text-900)]">Abdullah Bamhisoun</h3>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <p className="text-[var(--color-text-900)]">Week {report.weekNumber}</p>
                  </div>
                  <div className="col-span-3 flex items-center">
                    <p className="text-[var(--color-text-600)]">{report.dateRange}</p>
                  </div>
                  <div className="col-span-2 flex items-center">
                    <StatusBadge status={report.status} />
                  </div>
                  <div className="col-span-2 flex items-center">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/supervisor/weekly-report/${report.id}`)}
                    >
                      Review
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}