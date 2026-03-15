import { useState } from 'react';
import { Layout } from '../../components/layout/Layout';
import { StatusBadge } from '../../features/submissions/components/StatusBadge';
import { Button } from '../../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/AuthContext';
import { getSubmissionsForSupervisor } from '../../services/submissions';
import { getWeeklyReportsForSupervisor } from '../../services/weekly-reports';
import { getGroupsForSupervisor } from '../../services/groups';
import { useNavigate } from 'react-router-dom';
import { Filter, FileText, Clock } from 'lucide-react';
import { useEffect } from 'react';
import type { Submission, WeeklyReport } from '../../types';

export function SupervisorReviewsInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);
  const [allWeeklyReports, setAllWeeklyReports] = useState<WeeklyReport[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string; course: string; students: string[] }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getSubmissionsForSupervisor(user.id),
      getWeeklyReportsForSupervisor(user.id),
      getGroupsForSupervisor(user.id),
    ]).then(([subs, reports, grps]) => {
      setAllSubmissions(subs);
      setAllWeeklyReports(reports);
      setGroups(grps.map(g => ({
        id: g.id,
        name: `Group ${g.groupCode} - ${g.projectName}`,
        course: g.courseCode as 'CPIS-498' | 'CPIS-499',
        students: g.members.map(m => m.name),
      })));
    }).finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Reviews Inbox"><div className="p-6">Loading...</div></Layout>;

  const currentGroup = groups.find(g => g.id === selectedGroup);

  const submissions = allSubmissions.filter(s => {
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesStatus;
  });

  return (
    <Layout user={user} pageTitle="Reviews Inbox">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          Review student submissions and weekly reports
        </p>
      </div>

      {/* Group Selection */}
      <div className="mb-6 bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-4 sm:p-6">
        <div className="max-w-md">
          <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger id="group-select">
              <SelectValue placeholder="Choose a group to review" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentGroup && (
            <p className="text-[var(--color-text-600)] mt-2 text-sm">
              Students: {currentGroup.students.join(', ')}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="submissions" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="submissions">Submissions ({submissions.length})</TabsTrigger>
          <TabsTrigger value="weekly-reports">Weekly Reports ({allWeeklyReports.length})</TabsTrigger>
        </TabsList>

        {/* ── Submissions Tab ── */}
        <TabsContent value="submissions">
          {/* Filters */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </Button>
            <select
              className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)] text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="submitted">Submitted</option>
              <option value="under-review">Under Review</option>
              <option value="changes-requested">Changes Requested</option>
              <option value="approved">Approved</option>
            </select>
            <select className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-white)] text-sm">
              <option>All Courses</option>
              <option>CPIS-498</option>
              <option>CPIS-499</option>
            </select>
          </div>

          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)] bg-[var(--color-surface-alt)]">
              <div className="col-span-3">Group / Project</div>
              <div className="col-span-3">Milestone</div>
              <div className="col-span-2">Submitted</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Actions</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {submissions.length === 0 && (
                <div className="py-12 text-center text-sm text-[var(--color-text-600)]">No submissions found</div>
              )}
              {submissions.map((submission) => (
                <div key={submission.id}>
                  {/* Mobile card */}
                  <div className="sm:hidden p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-900)] truncate">{submission.projectName}</p>
                        <p className="text-xs text-[var(--color-text-600)]">{submission.studentName}</p>
                      </div>
                      <StatusBadge status={submission.status} />
                    </div>
                    <p className="text-sm text-[var(--color-text-700)]">{submission.milestoneName}</p>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-600)]">
                      <Clock className="w-3 h-3" />
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button size="sm" className="flex-1"
                        onClick={() => navigate(`/supervisor/review/${submission.id}`)}>
                        {submission.status === 'submitted' || submission.status === 'under-review' ? 'Review' : 'View'}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1"
                        onClick={() => navigate('/supervisor/evaluation')}>
                        Evaluate
                      </Button>
                    </div>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-4 hover:bg-[var(--color-surface-alt)] transition-colors items-center">
                    <div className="col-span-3">
                      <p className="text-sm font-medium text-[var(--color-text-900)]">{submission.projectName}</p>
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{submission.studentName}</p>
                    </div>
                    <div className="col-span-3">
                      <p className="text-sm text-[var(--color-text-900)]">{submission.milestoneName}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--color-text-600)]">
                        <FileText className="w-3 h-3" />
                        Version {submission.currentVersion}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center gap-1.5 text-sm text-[var(--color-text-600)]">
                      <Clock className="w-4 h-4 flex-shrink-0" />
                      {new Date(submission.submittedAt).toLocaleDateString()}
                    </div>
                    <div className="col-span-2">
                      <StatusBadge status={submission.status} />
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <Button size="sm"
                        onClick={() => navigate(`/supervisor/review/${submission.id}`)}>
                        {submission.status === 'submitted' || submission.status === 'under-review' ? 'Review' : 'View'}
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => navigate('/supervisor/evaluation')}>
                        Evaluate
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ── Weekly Reports Tab ── */}
        <TabsContent value="weekly-reports">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
            {/* Desktop header */}
            <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-3 border-b border-[var(--color-border)] text-xs font-semibold uppercase tracking-wide text-[var(--color-text-600)] bg-[var(--color-surface-alt)]">
              <div className="col-span-3">Student</div>
              <div className="col-span-2">Week</div>
              <div className="col-span-4">Date Range</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1">Action</div>
            </div>

            <div className="divide-y divide-[var(--color-border)]">
              {allWeeklyReports.length === 0 && (
                <div className="py-12 text-center text-sm text-[var(--color-text-600)]">No weekly reports found</div>
              )}
              {allWeeklyReports.map((report) => (
                <div key={report.id}>
                  {/* Mobile card */}
                  <div className="sm:hidden p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text-900)]">Week {report.weekNumber}</p>
                        <p className="text-xs text-[var(--color-text-600)]">{report.dateRange}</p>
                      </div>
                      <StatusBadge status={report.status} />
                    </div>
                    <Button size="sm" className="w-full"
                      onClick={() => navigate(`/supervisor/weekly-report/${report.id}`)}>
                      Review
                    </Button>
                  </div>

                  {/* Desktop row */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-4 px-4 py-4 hover:bg-[var(--color-surface-alt)] transition-colors items-center">
                    <div className="col-span-3">
                      <p className="text-sm text-[var(--color-text-900)]">Abdullah Bamhisoun</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-[var(--color-text-900)]">Week {report.weekNumber}</p>
                    </div>
                    <div className="col-span-4">
                      <p className="text-sm text-[var(--color-text-600)]">{report.dateRange}</p>
                    </div>
                    <div className="col-span-2">
                      <StatusBadge status={report.status} />
                    </div>
                    <div className="col-span-1">
                      <Button size="sm"
                        onClick={() => navigate(`/supervisor/weekly-report/${report.id}`)}>
                        Review
                      </Button>
                    </div>
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
