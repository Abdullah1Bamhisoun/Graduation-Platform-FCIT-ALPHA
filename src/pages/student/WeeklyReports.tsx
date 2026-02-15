import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/AuthContext';
import { getWeeklyReportsByGroup, submitStudentWeeklyReport } from '../../services/weekly-reports';
import { getGroupForStudent } from '../../services/groups';
import { Eye, Plus } from 'lucide-react';
import { WeeklyReport } from '../../types';
import { toast } from 'sonner';

export function StudentWeeklyReports() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);
  const [showAddReportDialog, setShowAddReportDialog] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [progress, setProgress] = useState('');
  const [futureWork, setFutureWork] = useState('');
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [groupReports, setGroupReports] = useState<WeeklyReport[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const group = await getGroupForStudent(user.id);
        if (group) {
          setGroupId(group.id);
          const reports = await getWeeklyReportsByGroup(group.id);
          setGroupReports(reports);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Generate 14 weeks
  const weeks = Array.from({ length: 14 }, (_, i) => i + 1);
  
  // Find report for each week
  const getReportForWeek = (weekNum: number) => {
    return groupReports.find(r => r.weekNumber === weekNum);
  };

  const handleAddReport = (weekNum: number) => {
    setSelectedWeek(weekNum);
    setProgress('');
    setFutureWork('');
    setDiscussionPoints('');
    setShowAddReportDialog(true);
  };

  const handleSubmitReport = async () => {
    if (!progress || !futureWork || !discussionPoints) {
      toast.error('Please fill in all fields');
      return;
    }
    if (!groupId || !selectedWeek) {
      toast.error('Group not found. Please contact support.');
      return;
    }

    setSubmitting(true);
    try {
      await submitStudentWeeklyReport({
        groupId,
        weekNumber: selectedWeek,
        progress,
        futureWork,
        discussionPoints,
      });
      // Refresh the report list
      const reports = await getWeeklyReportsByGroup(groupId);
      setGroupReports(reports);
      toast.success(`Week ${selectedWeek} report submitted successfully`);
      setShowAddReportDialog(false);
      setProgress('');
      setFutureWork('');
      setDiscussionPoints('');
      setSelectedWeek(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'good':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'satisfactory':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs-improvement':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressStatusText = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'Excellent Progress';
      case 'good':
        return 'Good Progress';
      case 'satisfactory':
        return 'Satisfactory';
      case 'needs-improvement':
        return 'Needs Improvement';
      default:
        return status;
    }
  };

  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Weekly Reports"><div className="p-6">Loading...</div></Layout>;

  return (
    <Layout user={user} pageTitle="Weekly Reports">
      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          View your weekly progress reports submitted by your supervisor
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {weeks.map((weekNum) => {
          const report = getReportForWeek(weekNum);
          const isDisabled = weekNum > 9 && !report;
          
          return (
            <div
              key={weekNum}
              className={`bg-[var(--color-surface-white)] rounded-xl border shadow-sm p-6 transition-all ${
                isDisabled
                  ? 'border-gray-200 opacity-50 cursor-not-allowed'
                  : report
                  ? 'border-[var(--color-border)] hover:shadow-md cursor-pointer'
                  : 'border-[var(--color-border)]'
              }`}
              onClick={() => report && !isDisabled && setSelectedReport(report)}
            >
              <div className="text-center">
                <div className={`text-4xl mb-2 ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-900)]'}`}>
                  {weekNum}
                </div>
                <div className={`mb-4 ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-600)]'}`}>
                  Week {weekNum}
                </div>
                
                {report ? (
                  <>
                    <div className={`inline-block px-3 py-1 rounded-full border text-xs mb-3 ${getProgressStatusColor(report.progressStatus)}`}>
                      {getProgressStatusText(report.progressStatus)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReport(report);
                      }}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      View Report
                    </Button>
                  </>
                ) : !isDisabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddReport(weekNum);
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Report
                  </Button>
                ) : (
                  <div className={`text-xs ${isDisabled ? 'text-gray-400' : 'text-[var(--color-text-600)]'}`}>
                    {isDisabled ? 'Not Available' : 'Not Submitted'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedReport(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6">
                <h2 className="text-[var(--color-text-900)] mb-2">Week {selectedReport.weekNumber} Progress Report</h2>
                <p className="text-[var(--color-text-600)]">
                  {selectedReport.weekNumber === 9 
                    ? 'Not submitted yet' 
                    : 'Your supervisor has submitted your progress report. More information is available in the below table:'}
                </p>
              </div>

              <div className="p-6">
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y divide-[var(--color-border)]">
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] w-1/3">Course</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.course}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Group ID</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.groupId}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Week#</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.weekNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Did all group members attend the meeting?</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.allMembersAttended ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Absent student name</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.absentStudentName || '-'}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Progress status</td>
                        <td className="p-4">
                          <div className={`inline-block px-3 py-1 rounded-full border text-xs ${getProgressStatusColor(selectedReport.progressStatus)}`}>
                            {getProgressStatusText(selectedReport.progressStatus)}
                          </div>
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] align-top">Supervisor Comments</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.supervisorComments}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setSelectedReport(null)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Report Dialog */}
      <Dialog open={showAddReportDialog} onOpenChange={setShowAddReportDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Report for Week {selectedWeek}</DialogTitle>
            <DialogDescription>
              Submit your weekly progress report including tasks accomplished and challenges faced.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="progress" className="text-[var(--color-text-900)]">
                Progress *
              </Label>
              <p className="text-[var(--color-text-600)] text-xs">
                Write down your progress since the last weekly progress report
              </p>
              <Textarea 
                id="progress"
                value={progress}
                onChange={(e) => setProgress(e.target.value)}
                placeholder="Describe your progress..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="futureWork" className="text-[var(--color-text-900)]">
                Future Work *
              </Label>
              <p className="text-[var(--color-text-600)] text-xs">
                The planned tasks for the next week
              </p>
              <Textarea 
                id="futureWork"
                value={futureWork}
                onChange={(e) => setFutureWork(e.target.value)}
                placeholder="Describe your plans for next week..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="discussionPoints" className="text-[var(--color-text-900)]">
                Discussion Points *
              </Label>
              <p className="text-[var(--color-text-600)] text-xs">
                The points you would like to discuss with your supervisor
              </p>
              <Textarea 
                id="discussionPoints"
                value={discussionPoints}
                onChange={(e) => setDiscussionPoints(e.target.value)}
                placeholder="Points to discuss with supervisor..."
                rows={6}
                className="resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddReportDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitReport}
                disabled={submitting}
                className="bg-[#10B981] text-[rgb(0,0,0)] hover:bg-[#0ea572]"
              >
                {submitting ? 'Submitting…' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
