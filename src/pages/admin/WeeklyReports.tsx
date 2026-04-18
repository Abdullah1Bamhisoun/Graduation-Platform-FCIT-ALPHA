import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { getAllWeeklyReports } from '../../services/weekly-reports';
import { getProfilesByRole } from '../../services/profiles';
import { getAllGroups } from '../../services/groups';
import type { GroupData } from '../../services/groups';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import { Eye, ChevronDown, ChevronRight, Unlock, EyeOff, Lock, ChevronUp, CheckCircle, Clock, Calendar, X } from 'lucide-react';
import { WeeklyReport } from '../../types';
import type { User, WeekStatus, WeekDisplayStatus } from '../../types';
import {
  getWeekStatuses,
  getDisplayStatus,
  openWeek,
  closeWeek,
  setWeekDeadline,
} from '../../services/week-statuses';
import { toast } from 'sonner';

const GROUP_WEEK_STATUS_STYLES: Record<WeekDisplayStatus, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-200',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-200',
  'Locked':     'bg-red-100 text-red-700 border-red-200',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
  'Upcoming':   'bg-blue-100 text-blue-700 border-blue-200',
};

type CourseTab = '498' | '499';


export function AdminWeeklyReports() {
  const { user } = useAuth();
  const [allReports, setAllReports] = useState<WeeklyReport[]>([]);
  const [supervisorProfiles, setSupervisorProfiles] = useState<User[]>([]);
  const [allGroups, setAllGroups] = useState<GroupData[]>([]);
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<WeeklyReport | null>(null);

  // ── Week control state ───────────────────────────────────────────────────
  const [activeCourse, setActiveCourse]           = useState<CourseTab>('498');
  const [weekStatuses, setWeekStatuses]           = useState<WeekStatus[]>([]);
  const [weekLoading, setWeekLoading]             = useState(true);
  const [weekError, setWeekError]                 = useState<string | null>(null);
  const [weekActionLoading, setWeekActionLoading] = useState<string | null>(null);
  const [weekPanelOpen, setWeekPanelOpen]         = useState(true);

  // ── Deadline dialog state ─────────────────────────────────────────────────
  const [deadlineTarget,  setDeadlineTarget]  = useState<WeekStatus | null>(null);
  const [deadlineOpenAt,  setDeadlineOpenAt]  = useState('');
  const [deadlineCloseAt, setDeadlineCloseAt] = useState('');
  const [deadlineSaving,  setDeadlineSaving]  = useState(false);

  // ── Group-level week statuses (for selected group's week cards) ──────────
  const [groupWeekStatuses, setGroupWeekStatuses] = useState<WeekStatus[]>([]);

  useEffect(() => {
    Promise.all([
      getAllWeeklyReports(),
      getProfilesByRole('supervisor'),
      getAllGroups(),
    ]).then(([reports, sups, groups]) => {
      setAllReports(reports);
      setSupervisorProfiles(sups);
      setAllGroups(groups);
    });
  }, []);

  // ── Load week statuses ───────────────────────────────────────────────────
  const loadWeekStatuses = useCallback(async (ct: CourseTab) => {
    setWeekLoading(true);
    setWeekError(null);
    try {
      const statuses = await getWeekStatuses(ct);
      setWeekStatuses(statuses);
    } catch (err: any) {
      console.error('Failed to load week statuses:', err);
      setWeekError(err?.message || 'Failed to load week statuses');
      setWeekStatuses([]);
    } finally {
      setWeekLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadWeekStatuses(activeCourse);
  }, [user, activeCourse, loadWeekStatuses]);

  // Load week statuses for the selected group's course type
  useEffect(() => {
    if (!selectedGroup) { setGroupWeekStatuses([]); return; }
    const group = allGroups.find(g => g.id === selectedGroup);
    if (!group) return;
    const ct: '498' | '499' = group.courseCode?.includes('499') ? '499' : '498';
    getWeekStatuses(ct).then(setGroupWeekStatuses).catch(() => setGroupWeekStatuses([]));
  }, [selectedGroup, allGroups]);

  // ── Week actions ─────────────────────────────────────────────────────────
  const handleOpen = async (ws: WeekStatus) => {
    if (!user) return;
    setWeekActionLoading(ws.id);
    try {
      await openWeek(ws.id, user.id);
      await loadWeekStatuses(activeCourse);
      toast.success(`Week ${ws.weekNumber} opened`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open week');
    } finally {
      setWeekActionLoading(null);
    }
  };

  const handleClose = async (ws: WeekStatus) => {
    setWeekActionLoading(ws.id);
    try {
      await closeWeek(ws.id);
      await loadWeekStatuses(activeCourse);
      toast.success(`Week ${ws.weekNumber} closed`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to close week');
    } finally {
      setWeekActionLoading(null);
    }
  };

  const openDeadlineDialog = (ws: WeekStatus) => {
    setDeadlineTarget(ws);
    setDeadlineOpenAt(ws.openAt  ? ws.openAt.slice(0, 16)  : '');
    setDeadlineCloseAt(ws.closeAt ? ws.closeAt.slice(0, 16) : '');
  };

  const handleSaveDeadline = async () => {
    if (!deadlineTarget) return;
    setDeadlineSaving(true);
    try {
      await setWeekDeadline(
        deadlineTarget.id,
        deadlineOpenAt  ? new Date(deadlineOpenAt).toISOString()  : null,
        deadlineCloseAt ? new Date(deadlineCloseAt).toISOString() : null,
      );
      await loadWeekStatuses(activeCourse);
      toast.success(`Deadline saved for Week ${deadlineTarget.weekNumber}`);
      setDeadlineTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save deadline');
    } finally {
      setDeadlineSaving(false);
    }
  };

  const handleClearDeadline = async () => {
    if (!deadlineTarget) return;
    setDeadlineSaving(true);
    try {
      await setWeekDeadline(deadlineTarget.id, null, null);
      await loadWeekStatuses(activeCourse);
      toast.success(`Deadline cleared for Week ${deadlineTarget.weekNumber}`);
      setDeadlineTarget(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to clear deadline');
    } finally {
      setDeadlineSaving(false);
    }
  };

  if (!user) return null;

  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);

  const groupReports = selectedGroup ? allReports.filter(r => r.groupId === selectedGroup) : [];
  const getReportForWeek = (weekNum: number) =>
    groupReports.find(r => r.weekNumber === weekNum);

  const toggleSupervisor = (supervisorId: string) => {
    const newExpanded = new Set(expandedSupervisors);
    if (newExpanded.has(supervisorId)) newExpanded.delete(supervisorId);
    else newExpanded.add(supervisorId);
    setExpandedSupervisors(newExpanded);
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':      return 'text-green-600 bg-green-50 border-green-200';
      case 'good':           return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'satisfactory':   return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs-improvement': return 'text-red-600 bg-red-50 border-red-200';
      default:               return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressStatusText = (status: string) => {
    switch (status) {
      case 'excellent':      return 'Excellent Progress';
      case 'good':           return 'Good Progress';
      case 'satisfactory':   return 'Satisfactory';
      case 'needs-improvement': return 'Needs Improvement';
      default:               return status;
    }
  };

  const supervisorTree = supervisorProfiles.map(sup => ({
    id: sup.id,
    name: sup.name,
    groups: allGroups.filter(g => g.supervisorId === sup.id),
  }));

  const currentGroup = allGroups.find(g => g.id === selectedGroup) ?? null;
  const openedCount  = weekStatuses.filter(ws => ws.wasOpened).length;

  return (
    <Layout user={user} pageTitle="Weekly Reports - All Groups">

      {/* ── Week Control Panel ─────────────────────────────────────────── */}
      <div className="mb-6 bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">

        {/* Header row */}
        <div className="flex items-stretch border-b border-[var(--color-border)]">

          {/* Course switcher tabs — prominent left side, distinct colors per course */}
          <div className="flex border-r border-[var(--color-border)]">
            <button
              onClick={() => setActiveCourse('498')}
              className={`px-6 py-3.5 font-bold text-sm transition-all relative border-r border-[var(--color-border)] ${
                activeCourse === '498'
                  ? 'bg-blue-600 text-white shadow-inner'
                  : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              }`}
            >
              CPIS-498
              {activeCourse === '498' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-blue-300/50 rounded-t" />
              )}
            </button>
            <button
              onClick={() => setActiveCourse('499')}
              className={`px-6 py-3.5 font-bold text-sm transition-all relative ${
                activeCourse === '499'
                  ? 'bg-violet-600 text-white shadow-inner'
                  : 'bg-violet-50 text-violet-600 hover:bg-violet-100'
              }`}
            >
              CPIS-499
              {activeCourse === '499' && (
                <span className="absolute bottom-0 left-0 right-0 h-1 bg-violet-300/50 rounded-t" />
              )}
            </button>
          </div>

          {/* Collapse toggle — takes remaining space */}
          <button
            className="flex-1 flex items-center justify-between px-3 sm:px-5 py-3.5 hover:bg-[var(--color-surface-alt)] transition-colors min-w-0"
            onClick={() => setWeekPanelOpen(v => !v)}
          >
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-[var(--color-text-600)] shrink-0" />
              <span className="font-medium text-[var(--color-text-900)]">
                Week Control
              </span>
              <span className={`hidden sm:inline text-xs font-semibold px-2 py-0.5 rounded-full ${
                activeCourse === '498'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-violet-100 text-violet-700'
              }`}>
                CPIS-{activeCourse}
              </span>
              <span className="text-xs text-[var(--color-text-500)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
                {weekLoading ? '…' : `${openedCount} / 16 activated`}
              </span>
            </div>
            {weekPanelOpen
              ? <ChevronUp className="w-4 h-4 text-[var(--color-text-600)] shrink-0 ml-2" />
              : <ChevronDown className="w-4 h-4 text-[var(--color-text-600)] shrink-0 ml-2" />}
          </button>
        </div>

        {/* 16-week grid — always renders all weeks */}
        {weekPanelOpen && (
          <div className="p-5">
            {weekError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold mb-1">Database setup required</p>
                <p className="mb-3 text-red-600">Run this SQL once in your <strong>Supabase SQL Editor</strong>:</p>
                <pre className="bg-red-100 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre">{`-- Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS week_statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_type text NOT NULL CHECK (course_type IN ('498','499')),
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 16),
  is_open     boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,
  was_opened  boolean NOT NULL DEFAULT false,
  updated_by  uuid,
  updated_at  timestamptz DEFAULT now()
);

-- If the table already existed, add any missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='week_statuses' AND column_name='is_locked') THEN
    ALTER TABLE week_statuses ADD COLUMN is_locked boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='week_statuses' AND column_name='was_opened') THEN
    ALTER TABLE week_statuses ADD COLUMN was_opened boolean NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='week_statuses' AND column_name='updated_by') THEN
    ALTER TABLE week_statuses ADD COLUMN updated_by uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname='week_statuses_unique_week') THEN
    ALTER TABLE week_statuses
      ADD CONSTRAINT week_statuses_unique_week UNIQUE (course_type, week_number);
  END IF;
END;
$$;`}</pre>
                <p className="mt-3 text-xs text-red-500">Then refresh this page.</p>
              </div>
            ) : weekLoading ? (
              <div className="grid grid-cols-8 gap-2">
                {Array.from({ length: 16 }).map((_, i) => (
                  <div key={i} className="h-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {weeks.map(wn => {
                  const ws = weekStatuses.find(s => s.weekNumber === wn);
                  const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                  const busy = ws ? weekActionLoading === ws.id : false;

                  return (
                    <div
                      key={wn}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border bg-[var(--color-surface-alt)] transition-colors ${
                        display === 'Open'     ? 'border-green-300 bg-green-50' :
                        display === 'Upcoming' ? 'border-blue-300 bg-blue-50'  :
                        display === 'Locked'   ? 'border-red-200'              :
                        'border-[var(--color-border)]'
                      }`}
                    >
                      <span className="text-xs font-semibold text-[var(--color-text-700)]">W{wn}</span>
                      {display !== 'Not Opened' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium leading-tight text-center ${GROUP_WEEK_STATUS_STYLES[display]}`}>
                          {display}
                        </span>
                      )}

                      {/* Action buttons */}
                      {ws && !ws.isLocked && !ws.isOpen && (
                        <button
                          disabled={busy}
                          onClick={() => handleOpen(ws)}
                          className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-green-300 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors"
                        >
                          <Unlock className="w-2.5 h-2.5" />
                          Open
                        </button>
                      )}
                      {ws && !ws.isLocked && ws.isOpen && (
                        <button
                          disabled={busy}
                          onClick={() => handleClose(ws)}
                          className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-gray-300 text-gray-600 bg-white hover:bg-gray-50 disabled:opacity-50 transition-colors"
                        >
                          <EyeOff className="w-2.5 h-2.5" />
                          Close
                        </button>
                      )}
                      {ws?.isLocked && (
                        <span className="text-xs text-red-500 italic flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                      {!ws && (
                        <span className="text-xs text-[var(--color-text-400)] italic">—</span>
                      )}

                      {/* Deadline button */}
                      {ws && !ws.isLocked && (
                        <button
                          onClick={() => openDeadlineDialog(ws)}
                          title={ws.closeAt ? `Deadline: ${new Date(ws.closeAt).toLocaleString()}` : 'Set deadline'}
                          className={`w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border transition-colors ${
                            ws.closeAt
                              ? 'border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100'
                              : 'border-[var(--color-border)] text-[var(--color-text-500)] bg-white hover:bg-[var(--color-surface-alt)]'
                          }`}
                        >
                          <Calendar className="w-2.5 h-2.5" />
                          {ws.closeAt ? 'Edit' : 'Deadline'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <p className="text-[var(--color-text-600)]">
          View all weekly reports organized by supervisor
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-1 lg:col-span-3">
          <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="text-[var(--color-text-900)]">Supervisors & Groups</h3>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              {supervisorTree.length === 0 && (
                <p className="p-4 text-[var(--color-text-600)] text-sm">No supervisors found</p>
              )}
              {supervisorTree.map((supervisor) => (
                <div key={supervisor.id}>
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
                    onClick={() => toggleSupervisor(supervisor.id)}
                  >
                    <span className="text-[var(--color-text-900)]">{supervisor.name}</span>
                    {expandedSupervisors.has(supervisor.id)
                      ? <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />
                      : <ChevronRight className="w-4 h-4 text-[var(--color-text-600)]" />}
                  </div>
                  {expandedSupervisors.has(supervisor.id) && (
                    <div className="bg-[var(--color-surface-alt)] divide-y divide-[var(--color-border)]">
                      {supervisor.groups.length === 0 && (
                        <p className="p-3 pl-8 text-[var(--color-text-600)] text-xs">No groups assigned</p>
                      )}
                      {supervisor.groups.map((group) => (
                        <div
                          key={group.id}
                          className={`p-3 pl-8 cursor-pointer hover:bg-[var(--color-border)] transition-colors ${
                            selectedGroup === group.id
                              ? 'bg-[var(--color-primary-100)] border-l-4 border-[var(--color-primary-600)]'
                              : ''
                          }`}
                          onClick={() => setSelectedGroup(group.id)}
                        >
                          <div className="text-[var(--color-text-900)]">{group.groupCode}</div>
                          <div className="text-[var(--color-text-600)] text-xs mt-1">{group.courseCode}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="col-span-1 lg:col-span-9">
          {selectedGroup ? (
            <>
              <div className="mb-4">
                <h2 className="text-[var(--color-text-900)] mb-1">
                  {currentGroup ? `${currentGroup.groupCode} — ${currentGroup.projectName}` : ''}
                </h2>
                <p className="text-[var(--color-text-600)]">View weekly progress reports</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {weeks.map((weekNum) => {
                  const report = getReportForWeek(weekNum);
                  const ws = groupWeekStatuses.find(s => s.weekNumber === weekNum);
                  const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                  const studentSubmitted = report?.submissionStatus === 'submitted';
                  const supervisorResponded = report?.supervisorResponseStatus === 'responded';

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
                      {/* Header: week number + week open/closed status */}
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-[var(--color-text-900)]">Week {weekNum}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${GROUP_WEEK_STATUS_STYLES[display]}`}>
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

                      {/* Submission/review status */}
                      {report ? (
                        <>
                          <div className="mb-3">
                            {supervisorResponded ? (
                              <div className={`inline-block px-2 py-0.5 rounded-full border text-xs ${getProgressStatusColor(report.progressStatus)}`}>
                                {getProgressStatusText(report.progressStatus)}
                              </div>
                            ) : studentSubmitted ? (
                              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Submitted
                              </span>
                            ) : null}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={(e) => { e.stopPropagation(); setSelectedReport(report); }}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Report
                          </Button>
                        </>
                      ) : (
                        <div className="text-xs text-[var(--color-text-600)]">Not Submitted</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] p-12 text-center">
              <p className="text-[var(--color-text-600)]">
                Select a group from the sidebar to view weekly reports
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Modal */}
      {selectedReport && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedReport(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-[var(--color-surface-white)] border-b border-[var(--color-border)] p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-[var(--color-text-900)] mb-1">Week {selectedReport.weekNumber} Progress Report</h2>
                    <p className="text-[var(--color-text-600)]">
                      {currentGroup ? `${currentGroup.groupCode} — ${currentGroup.projectName}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      selectedReport.studentMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>Student +{selectedReport.studentMark ?? 0}</span>
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      selectedReport.supervisorMark === 1 ? 'bg-green-50 text-green-600 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}>Supervisor +{selectedReport.supervisorMark ?? 0}</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="border border-[var(--color-border)] rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
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
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Week #</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.weekNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Supervisor</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.supervisorName}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">All members attended?</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.allMembersAttended ? 'Yes' : 'No'}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">Absent student</td>
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
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={() => setSelectedReport(null)}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      {/* Deadline Modal */}
      {deadlineTarget && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => !deadlineSaving && setDeadlineTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl w-full max-w-md">
              <div className="flex items-center justify-between p-5 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <h2 className="font-semibold text-[var(--color-text-900)]">
                    Set Deadline — Week {deadlineTarget.weekNumber}
                  </h2>
                </div>
                <button
                  onClick={() => setDeadlineTarget(null)}
                  disabled={deadlineSaving}
                  className="text-[var(--color-text-500)] hover:text-[var(--color-text-900)] disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-sm text-[var(--color-text-600)]">
                  Set the submission window for <strong>CPIS-{deadlineTarget.courseType} — Week {deadlineTarget.weekNumber}</strong>.
                  Leave both fields empty to rely on manual Open/Close controls.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-700)] mb-1">
                      Opens at
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DatePicker
                          value={deadlineOpenAt.split('T')[0] ?? ''}
                          onChange={date => setDeadlineOpenAt(date + 'T' + (deadlineOpenAt.split('T')[1] ?? '08:00'))}
                          placeholder="Select date"
                        />
                      </div>
                      <TimePicker
                        value={deadlineOpenAt.split('T')[1] ?? ''}
                        onChange={time => setDeadlineOpenAt((deadlineOpenAt.split('T')[0] ?? '') + 'T' + time)}
                        placeholder="Time"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text-700)] mb-1">
                      Closes at <span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <DatePicker
                          value={deadlineCloseAt.split('T')[0] ?? ''}
                          onChange={date => setDeadlineCloseAt(date + 'T' + (deadlineCloseAt.split('T')[1] ?? '23:59'))}
                          placeholder="Select date"
                        />
                      </div>
                      <TimePicker
                        value={deadlineCloseAt.split('T')[1] ?? ''}
                        onChange={time => setDeadlineCloseAt((deadlineCloseAt.split('T')[0] ?? '') + 'T' + time)}
                        placeholder="Time"
                      />
                    </div>
                  </div>
                </div>

                {deadlineTarget.closeAt && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Current deadline: <strong>{new Date(deadlineTarget.closeAt).toLocaleString()}</strong>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 p-5 border-t border-[var(--color-border)]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearDeadline}
                  disabled={deadlineSaving || (!deadlineTarget.openAt && !deadlineTarget.closeAt)}
                  className="text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  Clear Deadline
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeadlineTarget(null)}
                    disabled={deadlineSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveDeadline}
                    disabled={deadlineSaving}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Calendar className="w-4 h-4 mr-1.5" />
                    {deadlineSaving ? 'Saving…' : 'Save Deadline'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </Layout>
  );
}
