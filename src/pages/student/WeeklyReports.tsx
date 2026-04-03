import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../lib/AuthContext';
import { getWeeklyReportsByGroup, submitStudentWeeklyReport } from '../../services/weekly-reports';
import { getWeekStatuses, getDisplayStatus, isSubmissionOpen } from '../../services/week-statuses';
import { getGroupForStudent } from '../../services/groups';
import { Eye, Plus, Lock, AlertTriangle, Clock, CheckCircle, Calendar } from 'lucide-react';
import { useLockStatus } from '../../hooks/useLockStatus';
import { LockedBanner } from '../../components/ui/LockedBanner';
import type { WeeklyReport, WeekStatus } from '../../types';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WEEK_STATUS_STYLES: Record<string, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-200',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-200',
  'Locked':     'bg-red-100 text-red-700 border-red-200',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
  'Upcoming':   'bg-blue-100 text-blue-700 border-blue-200',
};

function courseTypeFromCode(code: string): '498' | '499' {
  return code.includes('499') ? '499' : '498';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function StudentWeeklyReports() {
  const { user } = useAuth();
  const { isLocked: isAdminLocked } = useLockStatus('weekly_reports');

  const [groupId, setGroupId]           = useState<string | null>(null);
  const [courseId, setCourseId]         = useState<string | null>(null);
  const [groupReports, setGroupReports] = useState<WeeklyReport[]>([]);
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // Submit report dialog
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [selectedWeek, setSelectedWeek]         = useState<number | null>(null);
  const [progress, setProgress]                 = useState('');
  const [futureWork, setFutureWork]             = useState('');
  const [discussionPoints, setDiscussionPoints] = useState('');
  const [submitting, setSubmitting]             = useState(false);

  // View report dialog
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  const SEMESTER = 'DEFAULT';

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const group = await getGroupForStudent(user.id);
        if (!group) { setLoading(false); return; }

        const cc = group.courseCode || group.courseNumber || group.groupCode || 'CPIS-498';
        const ct = courseTypeFromCode(cc);

        setGroupId(group.id);
        setCourseId(group.courseId ? group.courseId : null);

        const [reports, statuses] = await Promise.all([
          getWeeklyReportsByGroup(group.id),
          getWeekStatuses(ct, SEMESTER),
        ]);

        setGroupReports(reports);
        setWeekStatuses(statuses);
      } catch (err: any) {
        console.error('Failed to load weekly reports data:', err);
        setLoadError(err?.message || 'Failed to load weekly report data. Please refresh.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // ── Derived lookups ────────────────────────────────────────────────────────
  const getReportForWeek = (wn: number) => groupReports.find(r => r.weekNumber === wn);
  const getStatusForWeek = (wn: number) => weekStatuses.find(s => s.weekNumber === wn);

  // ── Submit weekly report ────────────────────────────────────────────────────
  const openSubmitDialog = (wn: number) => {
    setSelectedWeek(wn);
    setProgress('');
    setFutureWork('');
    setDiscussionPoints('');
    setShowSubmitDialog(true);
  };

  const handleSubmitReport = async () => {
    if (!progress || !futureWork || !discussionPoints) {
      toast.error('Please fill in all fields'); return;
    }
    if (!groupId || !selectedWeek || !courseId) {
      toast.error('Group not found. Please contact support.'); return;
    }

    setSubmitting(true);
    try {
      await submitStudentWeeklyReport({
        groupId,
        weekNumber: selectedWeek,
        courseId,
        progress,
        futureWork,
        discussionPoints,
      });
      const updated = await getWeeklyReportsByGroup(groupId);
      setGroupReports(updated);
      toast.success(`Week ${selectedWeek} report submitted`);
      setShowSubmitDialog(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!user) return null;
  if (loading) return <Layout user={user} pageTitle="Weekly Reports"><div className="p-6">Loading...</div></Layout>;
  if (loadError) return (
    <Layout user={user} pageTitle="Weekly Reports">
      <div className="flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 p-4 m-6">
        <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <p className="text-red-800 text-sm">{loadError}</p>
      </div>
    </Layout>
  );

  return (
    <Layout user={user} pageTitle="Weekly Reports">
      {isAdminLocked && <LockedBanner />}
      <div className="mb-6">
        <p className="text-[var(--color-text-600)] text-sm">
          16-week progress tracking — submit your weekly report during the open window.
        </p>
      </div>

      {!groupId && (
        <div className="flex items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4 mb-6">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 text-sm">You are not assigned to a group yet.</p>
        </div>
      )}

      {/* 16-Week Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 16 }, (_, i) => i + 1).map(wn => {
          const report    = getReportForWeek(wn);
          const ws        = getStatusForWeek(wn);
          const display   = ws ? getDisplayStatus(ws) : 'Not Opened';
          const isLocked  = ws?.isLocked ?? false;
          const wasOpened = ws?.wasOpened ?? false;
          const hasWindow = !!(ws?.openAt || ws?.closeAt);
          // A week is "active" (not dimmed) if it was manually opened or has a scheduled window that has started
          const isActive  = wasOpened || (hasWindow && ws?.openAt ? new Date() >= new Date(ws.openAt) : hasWindow);

          const canSubmit = isSubmissionOpen(ws) && !report && !isAdminLocked;

          return (
            <div
              key={wn}
              className={`bg-[var(--color-surface-white)] rounded-xl border shadow-sm p-5 transition-all ${
                !isActive ? 'opacity-50' : 'border-[var(--color-border)] hover:shadow-md'
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-[var(--color-text-900)]">Week {wn}</span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${WEEK_STATUS_STYLES[display]}`}>
                  {isLocked && <Lock className="w-3 h-3" />}
                  {display === 'Upcoming' && <Calendar className="w-3 h-3" />}
                  {display}
                </span>
              </div>

              {/* Submission window (shown when coordinator has configured one) */}
              {hasWindow && (
                <div className="mb-3 text-xs bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-blue-700 space-y-0.5">
                  {ws?.openAt && (
                    <p className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>
                        <span className="font-medium">Opens:</span>{' '}
                        {new Date(ws.openAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </p>
                  )}
                  {ws?.closeAt && (
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>
                        <span className="font-medium">Deadline:</span>{' '}
                        {new Date(ws.closeAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Report marks */}
              {isActive && (
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
              )}

              {/* Action area */}
              <div className="space-y-2">
                {report ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setSelectedReport(report)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Report
                  </Button>
                ) : canSubmit ? (
                  <Button
                    size="sm"
                    className="w-full bg-[#10B981] text-black hover:bg-[#0ea572]"
                    onClick={() => openSubmitDialog(wn)}
                    disabled={isAdminLocked}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Submit Report
                  </Button>
                ) : isActive && !canSubmit && !report ? (
                  <span className="text-xs text-red-600 text-center block">Missed — 0/2</span>
                ) : (
                  <span className="text-xs text-gray-400 text-center block">
                    {display === 'Not Opened'  ? 'Not activated'            :
                     display === 'Upcoming'    ? 'Submission not open yet'  :
                     display === 'Closed'      ? 'Submission window closed' :
                     'No action available'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── View Report Modal ─────────────────────────────────────── */}
      {selectedReport && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedReport(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-[var(--color-text-900)]">Week {selectedReport.weekNumber} Progress Report</h2>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      selectedReport.studentMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>Student +{selectedReport.studentMark}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      selectedReport.supervisorMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>Supervisor +{selectedReport.supervisorMark}</span>
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {selectedReport.studentProgress && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-700)] mb-1">Progress</h4>
                    <p className="text-sm text-[var(--color-text-900)] bg-[var(--color-surface-alt)] rounded-lg p-3">{selectedReport.studentProgress}</p>
                  </div>
                )}
                {selectedReport.futureWork && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-700)] mb-1">Future Work</h4>
                    <p className="text-sm text-[var(--color-text-900)] bg-[var(--color-surface-alt)] rounded-lg p-3">{selectedReport.futureWork}</p>
                  </div>
                )}
                {selectedReport.discussionPoints && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-700)] mb-1">Discussion Points</h4>
                    <p className="text-sm text-[var(--color-text-900)] bg-[var(--color-surface-alt)] rounded-lg p-3">{selectedReport.discussionPoints}</p>
                  </div>
                )}
                {selectedReport.supervisorComments && selectedReport.supervisorResponseStatus === 'responded' && (
                  <div>
                    <h4 className="text-sm font-medium text-[var(--color-text-700)] mb-1">Supervisor Feedback</h4>
                    <p className="text-sm text-[var(--color-text-900)] bg-blue-50 border border-blue-200 rounded-lg p-3">{selectedReport.supervisorComments}</p>
                  </div>
                )}
                {selectedReport.supervisorResponseStatus === 'pending' && (
                  <p className="text-sm text-[var(--color-text-600)] italic">Awaiting supervisor feedback.</p>
                )}
                <div className="flex justify-end pt-2">
                  <Button onClick={() => setSelectedReport(null)}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Submit Report Dialog ──────────────────────────────────── */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Week {selectedWeek} — Submit Report</DialogTitle>
            <DialogDescription>
              Submit your weekly progress. This grants you 1 mark; supervisor feedback grants the second mark.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="progress">Progress <span className="text-red-500">*</span></Label>
              <p className="text-xs text-[var(--color-text-600)]">What did you accomplish since the last report?</p>
              <Textarea id="progress" value={progress} onChange={e => setProgress(e.target.value)} rows={5} className="resize-none" placeholder="Describe your progress…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="futureWork">Future Work <span className="text-red-500">*</span></Label>
              <p className="text-xs text-[var(--color-text-600)]">Planned tasks for next week</p>
              <Textarea id="futureWork" value={futureWork} onChange={e => setFutureWork(e.target.value)} rows={5} className="resize-none" placeholder="Describe your plans…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discussion">Discussion Points <span className="text-red-500">*</span></Label>
              <p className="text-xs text-[var(--color-text-600)]">Points to discuss with your supervisor</p>
              <Textarea id="discussion" value={discussionPoints} onChange={e => setDiscussionPoints(e.target.value)} rows={5} className="resize-none" placeholder="Points to discuss…" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowSubmitDialog(false)}>Cancel</Button>
              <Button onClick={handleSubmitReport} disabled={submitting || isAdminLocked} className="bg-[#10B981] text-black hover:bg-[#0ea572]">
                {submitting ? 'Submitting…' : 'Submit Report'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </Layout>
  );
}
