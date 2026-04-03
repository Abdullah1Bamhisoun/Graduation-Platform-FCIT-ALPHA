import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useAuth } from '../../lib/AuthContext';
import { getGroupsForSupervisor } from '../../services/groups';
import {
  getWeeklyReportsByGroup,
  supervisorRespondToWeeklyReport,
} from '../../services/weekly-reports';
import { getWeekStatuses, getDisplayStatus } from '../../services/week-statuses';
import { Eye, X, MessageSquare, Lock, CheckCircle, Clock } from 'lucide-react';
import { WeeklyReport, WeekStatus, WeekDisplayStatus } from '../../types';
import { toast } from 'sonner';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';

const WEEK_STATUS_STYLES: Record<WeekDisplayStatus, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-200',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-200',
  'Locked':     'bg-red-100 text-red-700 border-red-200',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
  'Upcoming':   'bg-blue-100 text-blue-700 border-blue-200',
};

export function SupervisorWeeklyReports() {
  const { user } = useAuth();
  const { isLocked } = useLockStatus('weekly_reports');
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [showRespondForm, setShowRespondForm] = useState(false);
  const [respondingWeek, setRespondingWeek] = useState<number | null>(null);
  const [groups, setGroups] = useState<{ id: string; name: string; course: string; students: string[] }[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    allMembersAttended: 'true',
    absentStudentName: '',
    progressStatus: 'good' as 'excellent' | 'good' | 'satisfactory' | 'needs-improvement',
    supervisorComments: '',
  });

  useEffect(() => {
    if (!user) return;
    getGroupsForSupervisor(user.id).then((data) => {
      setGroups(data.map(g => ({
        id: g.id,
        name: `Group ${g.groupCode} - ${g.projectName}`,
        course: g.courseCode,
        students: g.members.map(m => m.name),
      })));
    });
  }, [user]);

  useEffect(() => {
    if (!selectedGroup) { setReports([]); setWeekStatuses([]); return; }
    const group = groups.find(g => g.id === selectedGroup);
    const ct: '498' | '499' = group?.course?.includes('499') ? '499' : '498';
    Promise.all([
      getWeeklyReportsByGroup(selectedGroup),
      getWeekStatuses(ct),
    ]).then(([rpts, statuses]) => {
      setReports(rpts);
      setWeekStatuses(statuses);
    });
  }, [selectedGroup, groups]);

  if (!user) return null;

  const currentGroup = groups.find(g => g.id === selectedGroup);
  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);
  const getReportForWeek = (weekNum: number) => reports.find(r => r.weekNumber === weekNum);
  const getWeekStatus = (weekNum: number) => weekStatuses.find(s => s.weekNumber === weekNum);

  const openRespondForm = (weekNum: number) => {
    setRespondingWeek(weekNum);
    setFormData({
      allMembersAttended: 'true',
      absentStudentName: '',
      progressStatus: 'good',
      supervisorComments: '',
    });
    setShowRespondForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !respondingWeek || !user) {
      toast.error('Missing required data');
      return;
    }
    if (!formData.supervisorComments.trim()) {
      toast.error('Please enter supervisor comments');
      return;
    }

    setSubmitting(true);
    try {
      await supervisorRespondToWeeklyReport({
        groupId: selectedGroup,
        weekNumber: respondingWeek,
        progressStatus: formData.progressStatus,
        supervisorComments: formData.supervisorComments,
        allMembersAttended: formData.allMembersAttended === 'true',
        absentStudentName: formData.absentStudentName || undefined,
        reviewedBy: user.id,
      });
      const updated = await getWeeklyReportsByGroup(selectedGroup);
      setReports(updated);
      toast.success(`Week ${respondingWeek} response submitted successfully!`);
      setShowRespondForm(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit response');
    } finally {
      setSubmitting(false);
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':  return 'text-green-600 bg-green-50 border-green-200';
      case 'good':       return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'satisfactory': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs-improvement': return 'text-red-600 bg-red-50 border-red-200';
      default:           return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressStatusText = (status: string) => {
    switch (status) {
      case 'excellent':  return 'Excellent Progress';
      case 'good':       return 'Good Progress';
      case 'satisfactory': return 'Satisfactory';
      case 'needs-improvement': return 'Needs Improvement';
      default:           return status;
    }
  };

  return (
    <Layout user={user} pageTitle="Weekly Reports">
      {isLocked && <LockedBanner />}
      <div className="mb-6">
        <div className="flex-1">
          <Label htmlFor="group-select" className="mb-2 block text-[var(--color-text-900)]">Select Group</Label>
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger id="group-select" className="w-full max-w-md">
              <SelectValue placeholder="Choose a group to view reports" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group.course})
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

      {selectedGroup ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weeks.map((weekNum) => {
            const report = getReportForWeek(weekNum);
            const ws = getWeekStatus(weekNum);
            const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
            const studentSubmitted = report?.submissionStatus === 'submitted';
            const supervisorResponded = report?.supervisorResponseStatus === 'responded';
            const canRespond = studentSubmitted && !supervisorResponded && !isLocked;

            return (
              <div
                key={weekNum}
                className={`bg-[var(--color-surface-white)] rounded-xl border shadow-sm p-5 transition-all ${
                  report
                    ? 'border-[var(--color-border)] hover:shadow-md cursor-pointer'
                    : 'border-[var(--color-border)]'
                }`}
                onClick={() => report && setSelectedReport(report)}
              >
                {/* Header: week number + status badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-[var(--color-text-900)]">Week {weekNum}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${WEEK_STATUS_STYLES[display]}`}>
                    {ws?.isLocked && <Lock className="w-3 h-3" />}
                    {display}
                  </span>
                </div>

                {/* Marks badges */}
                <div className="flex gap-2 mb-3">
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    report?.studentMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {report?.studentMark === 1 ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    Student
                  </span>
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${
                    report?.supervisorMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-400 border-gray-200'
                  }`}>
                    {report?.supervisorMark === 1 ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    Supervisor
                  </span>
                </div>

                {/* Submission status label */}
                <div className="mb-3">
                  {supervisorResponded ? (
                    <div className={`inline-block px-2 py-0.5 rounded-full border text-xs ${getProgressStatusColor(report!.progressStatus)}`}>
                      {getProgressStatusText(report!.progressStatus)}
                    </div>
                  ) : studentSubmitted ? (
                    <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                      Submitted — awaiting response
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not Submitted</span>
                  )}
                </div>

                {/* Actions */}
                {supervisorResponded ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => { e.stopPropagation(); setSelectedReport(report!); }}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Report
                  </Button>
                ) : canRespond ? (
                  <Button
                    size="sm"
                    className="w-full bg-[#10B981] text-black hover:bg-[#0ea572]"
                    onClick={(e) => { e.stopPropagation(); openRespondForm(weekNum); }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Respond
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
          <p className="text-[var(--color-text-600)]">
            Please select a group to view weekly reports
          </p>
        </div>
      )}

      {/* Respond Form Modal */}
      {showRespondForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowRespondForm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-[var(--color-text-900)]">Week {respondingWeek} — Supervisor Response</h2>
                  <p className="text-[var(--color-text-600)] mt-1">{currentGroup?.name}</p>
                </div>
                <button
                  onClick={() => setShowRespondForm(false)}
                  className="p-2 hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                {/* Show student submission content */}
                {(() => {
                  const r = getReportForWeek(respondingWeek!);
                  return r?.studentProgress ? (
                    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] p-4 space-y-3">
                      <p className="text-xs font-medium text-[var(--color-text-700)] uppercase tracking-wide">Student Submission</p>
                      {r.studentProgress && (
                        <div>
                          <p className="text-xs text-[var(--color-text-600)] mb-1">Progress</p>
                          <p className="text-sm text-[var(--color-text-900)]">{r.studentProgress}</p>
                        </div>
                      )}
                      {r.futureWork && (
                        <div>
                          <p className="text-xs text-[var(--color-text-600)] mb-1">Future Work</p>
                          <p className="text-sm text-[var(--color-text-900)]">{r.futureWork}</p>
                        </div>
                      )}
                      {r.discussionPoints && (
                        <div>
                          <p className="text-xs text-[var(--color-text-600)] mb-1">Discussion Points</p>
                          <p className="text-sm text-[var(--color-text-900)]">{r.discussionPoints}</p>
                        </div>
                      )}
                    </div>
                  ) : null;
                })()}

                <div>
                  <Label htmlFor="attendance">Did all group members attend the meeting? *</Label>
                  <Select
                    value={formData.allMembersAttended}
                    onValueChange={(value) => setFormData({ ...formData, allMembersAttended: value })}
                  >
                    <SelectTrigger id="attendance" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.allMembersAttended === 'false' && (
                  <div>
                    <Label htmlFor="absentStudent">Absent Student Name</Label>
                    <input
                      id="absentStudent"
                      type="text"
                      placeholder="Enter student name"
                      value={formData.absentStudentName}
                      onChange={(e) => setFormData({ ...formData, absentStudentName: e.target.value })}
                      className="mt-2 w-full border rounded-md px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="progressStatus">Progress Status *</Label>
                  <Select
                    value={formData.progressStatus}
                    onValueChange={(value: 'excellent' | 'good' | 'satisfactory' | 'needs-improvement') =>
                      setFormData({ ...formData, progressStatus: value })
                    }
                  >
                    <SelectTrigger id="progressStatus" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent Progress</SelectItem>
                      <SelectItem value="good">Good Progress</SelectItem>
                      <SelectItem value="satisfactory">Satisfactory</SelectItem>
                      <SelectItem value="needs-improvement">Needs Improvement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="supervisorComments">Supervisor Comments *</Label>
                  <Textarea
                    id="supervisorComments"
                    placeholder="Enter your feedback on the group's progress..."
                    value={formData.supervisorComments}
                    onChange={(e) => setFormData({ ...formData, supervisorComments: e.target.value })}
                    required
                    className="mt-2 min-h-[120px]"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowRespondForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-[#10B981] text-black hover:bg-[#0ea572]"
                    disabled={submitting || isLocked}
                  >
                    {submitting ? 'Submitting…' : 'Submit Response'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedReport(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6">
                <h2 className="text-[var(--color-text-900)] mb-2">Week {selectedReport.weekNumber} Progress Report</h2>
                <p className="text-[var(--color-text-600)]">
                  Report details for {currentGroup?.name}
                </p>
              </div>

              <div className="p-6">
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] w-1/3">Week #</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.weekNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Did all members attend?</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.allMembersAttended ? 'Yes' : 'No'}</td>
                      </tr>
                      {selectedReport.absentStudentName && (
                        <tr>
                          <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Absent student</td>
                          <td className="p-4 text-[var(--color-text-900)]">{selectedReport.absentStudentName}</td>
                        </tr>
                      )}
                      {selectedReport.studentProgress && (
                        <tr>
                          <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Student Progress</td>
                          <td className="p-4 text-[var(--color-text-900)]">{selectedReport.studentProgress}</td>
                        </tr>
                      )}
                      {selectedReport.futureWork && (
                        <tr>
                          <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Future Work</td>
                          <td className="p-4 text-[var(--color-text-900)]">{selectedReport.futureWork}</td>
                        </tr>
                      )}
                      {selectedReport.discussionPoints && (
                        <tr>
                          <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Discussion Points</td>
                          <td className="p-4 text-[var(--color-text-900)]">{selectedReport.discussionPoints}</td>
                        </tr>
                      )}
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Progress Status</td>
                        <td className="p-4">
                          <div className={`inline-block px-3 py-1 rounded-full border text-xs ${getProgressStatusColor(selectedReport.progressStatus)}`}>
                            {getProgressStatusText(selectedReport.progressStatus)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Supervisor Comments</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.supervisorComments || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setSelectedReport(null)}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
