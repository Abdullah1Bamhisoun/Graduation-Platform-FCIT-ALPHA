import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { getAllGroups } from '../../services/groups';
import type { GroupData } from '../../services/groups';
import { getWeeklyReportsByGroup } from '../../services/weekly-reports';
import {
  getWeekStatuses,
  getDisplayStatus,
  openWeek,
  closeWeek,
  setWeekDeadline,
} from '../../services/week-statuses';
import { Button } from '../../components/ui/button';
import { DatePicker } from '../../components/ui/DatePicker';
import { TimePicker } from '../../components/ui/TimePicker';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import {
  Eye, ChevronDown, ChevronRight, Unlock, EyeOff,
  Lock, ChevronUp, CheckCircle, Clock, Calendar, X, Mail,
} from 'lucide-react';
import type { WeeklyReport, WeekStatus, WeekDisplayStatus } from '../../types';
import { toast } from 'sonner';

const WEEK_STATUS_STYLES: Record<WeekDisplayStatus, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-300',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-300',
  'Locked':     'bg-red-100 text-red-700 border-red-300',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
  'Upcoming':   'bg-blue-100 text-blue-700 border-blue-300',
};

const CARD_STATUS_STYLES: Record<WeekDisplayStatus, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-200',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-200',
  'Locked':     'bg-red-100 text-red-700 border-red-200',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
  'Upcoming':   'bg-blue-100 text-blue-700 border-blue-200',
};

const SEMESTER = 'DEFAULT';

export function CoordinatorWeeklyReports() {
  const { user } = useAuth();

  // ── Week control state ────────────────────────────────────────────────────
  const [weekStatuses, setWeekStatuses]           = useState<WeekStatus[]>([]);
  const [weekLoading, setWeekLoading]             = useState(true);
  const [weekError, setWeekError]                 = useState<string | null>(null);
  const [courseType, setCourseType]               = useState<'498' | '499' | null>(null);
  const [weekActionLoading, setWeekActionLoading] = useState<string | null>(null);
  const [weekPanelOpen, setWeekPanelOpen]         = useState(true);

  // ── Open confirmation dialog state ───────────────────────────────────────
  const [openTarget, setOpenTarget] = useState<WeekStatus | null>(null);

  // ── Deadline dialog state ─────────────────────────────────────────────────
  const [deadlineWeek, setDeadlineWeek] = useState<WeekStatus | null>(null);
  const [dlOpenAt, setDlOpenAt]         = useState('');
  const [dlCloseAt, setDlCloseAt]       = useState('');
  const [dlSaving, setDlSaving]         = useState(false);

  // ── Groups & report state ─────────────────────────────────────────────────
  const [allGroups, setAllGroups]                     = useState<GroupData[]>([]);
  const [expandedSupervisors, setExpandedSupervisors] = useState<Set<string>>(new Set());
  const [selectedGroup, setSelectedGroup]             = useState<string>('');
  const [groupReports, setGroupReports]               = useState<WeeklyReport[]>([]);
  const [reportsLoading, setReportsLoading]           = useState(false);
  const [selectedReport, setSelectedReport]           = useState<WeeklyReport | null>(null);

  // ── Load week statuses ────────────────────────────────────────────────────
  const loadWeekStatuses = useCallback(async (ct: '498' | '499') => {
    setWeekLoading(true);
    setWeekError(null);
    try {
      const dept = user?.department ?? 'IS';
      const statuses = await getWeekStatuses(ct, SEMESTER, dept);
      setWeekStatuses(statuses);
    } catch (err: any) {
      console.error('Failed to load week statuses:', err);
      setWeekError(err?.message || 'Failed to load week statuses');
      setWeekStatuses([]);
    } finally {
      setWeekLoading(false);
    }
  }, [user?.department]);

  // ── Resolve course type + load groups ────────────────────────────────────
  useEffect(() => {
    if (!user?.coordinatorCourseId) return;
    (async () => {
      const { data } = await supabase
        .from('courses')
        .select('code')
        .eq('id', user.coordinatorCourseId)
        .maybeSingle();

      const ct: '498' | '499' = data?.code?.includes('499') ? '499' : '498';
      setCourseType(ct);
      loadWeekStatuses(ct);

      const groups = await getAllGroups();
      setAllGroups(groups.filter(g => g.courseId === user.coordinatorCourseId));
    })();
  }, [user?.coordinatorCourseId, loadWeekStatuses]);

  // ── Load reports on group select ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedGroup) { setGroupReports([]); return; }
    setReportsLoading(true);
    getWeeklyReportsByGroup(selectedGroup)
      .then(setGroupReports)
      .finally(() => setReportsLoading(false));
  }, [selectedGroup]);

  // ── Week control actions ──────────────────────────────────────────────────
  const handleOpenConfirmed = async () => {
    if (!user || !openTarget) return;
    const ws = openTarget;
    setOpenTarget(null);
    setWeekActionLoading(ws.id);
    try {
      await openWeek(ws.id, user.id, user.coordinatorCourseId ?? undefined);
      if (courseType) await loadWeekStatuses(courseType);
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
      if (courseType) await loadWeekStatuses(courseType);
      toast.success(`Week ${ws.weekNumber} closed`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to close week');
    } finally {
      setWeekActionLoading(null);
    }
  };

  // ── Deadline helpers ──────────────────────────────────────────────────────
  /** Convert an ISO string to the value expected by <input type="datetime-local"> */
  const toDatetimeLocal = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const openDeadlineDialog = (ws: WeekStatus) => {
    setDeadlineWeek(ws);
    setDlOpenAt(toDatetimeLocal(ws.openAt));
    setDlCloseAt(toDatetimeLocal(ws.closeAt));
  };

  const handleSaveDeadline = async () => {
    if (!deadlineWeek) return;

    // A valid combined value needs both a non-empty date part and a time part
    const isValidDt = (s: string) => {
      const [datePart] = s.split('T');
      return !!datePart && !isNaN(new Date(s).getTime());
    };

    const openAtISO  = dlOpenAt  && isValidDt(dlOpenAt)  ? new Date(dlOpenAt).toISOString()  : null;
    const closeAtISO = dlCloseAt && isValidDt(dlCloseAt) ? new Date(dlCloseAt).toISOString() : null;

    if (!openAtISO && !closeAtISO) {
      toast.error('Select at least one valid date and time');
      return;
    }
    if (openAtISO && closeAtISO && new Date(openAtISO) >= new Date(closeAtISO)) {
      toast.error('Open date must be before close date');
      return;
    }
    setDlSaving(true);
    try {
      // setWeekDeadline opens the week and emails students in one server call
      await setWeekDeadline(
        deadlineWeek.id,
        openAtISO,
        closeAtISO,
        user?.coordinatorCourseId ?? undefined
      );
      if (courseType) await loadWeekStatuses(courseType);
      toast.success(`Deadline saved and Week ${deadlineWeek.weekNumber} opened — students notified`);
      setDeadlineWeek(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save deadline');
    } finally {
      setDlSaving(false);
    }
  };

  const handleClearDeadline = async (ws: WeekStatus) => {
    try {
      await setWeekDeadline(ws.id, null, null);
      if (courseType) await loadWeekStatuses(courseType);
      toast.success(`Deadline cleared for Week ${ws.weekNumber}`);
      setDeadlineWeek(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to clear deadline');
    }
  };

  const toggleSupervisor = (supervisorId: string) => {
    const next = new Set(expandedSupervisors);
    if (next.has(supervisorId)) next.delete(supervisorId);
    else next.add(supervisorId);
    setExpandedSupervisors(next);
  };

  const getProgressStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':         return 'text-green-600 bg-green-50 border-green-200';
      case 'good':              return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'satisfactory':      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'needs-improvement': return 'text-red-600 bg-red-50 border-red-200';
      default:                  return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getProgressStatusText = (status: string) => {
    switch (status) {
      case 'excellent':         return 'Excellent Progress';
      case 'good':              return 'Good Progress';
      case 'satisfactory':      return 'Satisfactory';
      case 'needs-improvement': return 'Needs Improvement';
      default:                  return status;
    }
  };

  if (!user) return null;

  const weeks        = Array.from({ length: 16 }, (_, i) => i + 1);
  const openedCount  = weekStatuses.filter(ws => ws.wasOpened).length;
  const currentGroup = allGroups.find(g => g.id === selectedGroup) ?? null;
  const getReportForWeek = (wn: number) => groupReports.find(r => r.weekNumber === wn);

  // Build supervisor → groups tree
  const supervisorMap = new Map<string, { id: string; name: string; groups: GroupData[] }>();
  allGroups.forEach(g => {
    if (!supervisorMap.has(g.supervisorId)) {
      supervisorMap.set(g.supervisorId, { id: g.supervisorId, name: g.supervisorName, groups: [] });
    }
    supervisorMap.get(g.supervisorId)!.groups.push(g);
  });
  const supervisorTree = Array.from(supervisorMap.values());

  return (
    <Layout user={user} pageTitle="Weekly Reports">
      <div className="space-y-6">

        {/* ── Week Control Panel ──────────────────────────────────────── */}
        <div className="bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-sm">

          {/* Header */}
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-alt)] transition-colors"
            onClick={() => setWeekPanelOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-[var(--color-text-600)]" />
              <span className="font-medium text-[var(--color-text-900)]">Week Control</span>
              {courseType && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  CPIS-{courseType}
                </span>
              )}
              <span className="text-xs text-[var(--color-text-500)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
                {weekLoading ? '…' : `${openedCount} / 16 activated`}
              </span>
            </div>
            {weekPanelOpen
              ? <ChevronUp className="w-4 h-4 text-[var(--color-text-600)]" />
              : <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />}
          </button>

          {/* 16-week grid */}
          {weekPanelOpen && (
            <div className="border-t border-[var(--color-border)] p-5">
              {weekLoading ? (
                <div className="grid grid-cols-8 gap-2">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)] animate-pulse" />
                  ))}
                </div>
              ) : weekError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <p className="font-semibold mb-1">Failed to load weeks</p>
                  <p className="mb-3 font-mono text-xs bg-red-100 rounded px-2 py-1 break-all">{weekError}</p>
                  <p className="mb-2 text-red-600">If the error mentions a missing table or column, run this SQL in your <strong>Supabase SQL Editor</strong>:</p>
                  <pre className="bg-red-100 rounded p-3 text-xs font-mono overflow-x-auto whitespace-pre">{`-- Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS week_statuses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_type text NOT NULL CHECK (course_type IN ('498','499')),
  week_number integer NOT NULL CHECK (week_number BETWEEN 1 AND 16),
  is_open     boolean NOT NULL DEFAULT false,
  is_locked   boolean NOT NULL DEFAULT false,
  was_opened  boolean NOT NULL DEFAULT false,
  updated_by  uuid,
  updated_at  timestamptz DEFAULT now(),
  open_at     timestamptz DEFAULT NULL,
  close_at    timestamptz DEFAULT NULL
);

-- If the table already existed, add any missing columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='week_statuses' AND column_name='open_at') THEN
    ALTER TABLE week_statuses ADD COLUMN open_at timestamptz DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='week_statuses' AND column_name='close_at') THEN
    ALTER TABLE week_statuses ADD COLUMN close_at timestamptz DEFAULT NULL;
  END IF;
END;
$$;`}</pre>
                  <p className="mt-3 text-xs text-red-500">Then refresh this page.</p>
                </div>
              ) : weekStatuses.length === 0 ? (
                <p className="text-sm text-[var(--color-text-600)] text-center py-4">
                  No weeks found for this course. Ask the admin to initialize weeks from the Admin dashboard.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {weeks.map(wn => {
                    const ws      = weekStatuses.find(s => s.weekNumber === wn);
                    const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                    const busy    = ws ? weekActionLoading === ws.id : false;
                    const hasDeadline = !!(ws?.openAt || ws?.closeAt);

                    return (
                      <div
                        key={wn}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors ${
                          display === 'Open'     ? 'border-green-300 bg-green-50'  :
                          display === 'Upcoming' ? 'border-blue-300 bg-blue-50'   :
                          display === 'Locked'   ? 'border-red-200 bg-red-50'     :
                          'border-[var(--color-border)] bg-[var(--color-surface-alt)]'
                        }`}
                      >
                        <span className="text-xs font-semibold text-[var(--color-text-700)]">W{wn}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium leading-tight text-center ${WEEK_STATUS_STYLES[display]}`}>
                          {display}
                        </span>

                        {/* Deadline date indicator */}
                        {ws && hasDeadline && (
                          <span className="text-xs text-blue-600 flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {ws.closeAt
                              ? new Date(ws.closeAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : 'Scheduled'}
                          </span>
                        )}

                        {/* Open — fresh week, never opened, no deadline */}
                        {ws && !ws.isLocked && !ws.isOpen && !ws.wasOpened && !ws.openAt && (
                          <button
                            disabled={busy}
                            onClick={() => setOpenTarget(ws)}
                            className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-green-300 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            <Unlock className="w-2.5 h-2.5" />
                            Open
                          </button>
                        )}

                        {/* Reopen — was opened before OR has a deadline window (closed/past) */}
                        {ws && !ws.isLocked && !ws.isOpen && (ws.wasOpened || ws.openAt) && (
                          <button
                            disabled={busy}
                            onClick={() => setOpenTarget(ws)}
                            className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-green-300 text-green-700 bg-white hover:bg-green-50 disabled:opacity-50 transition-colors"
                          >
                            <Unlock className="w-2.5 h-2.5" />
                            Reopen
                          </button>
                        )}

                        {/* Close — week is currently open */}
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

                        {/* Deadline config button — always available for non-locked weeks */}
                        {ws && !ws.isLocked && (
                          <button
                            onClick={() => openDeadlineDialog(ws)}
                            className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-50 transition-colors"
                          >
                            <Calendar className="w-2.5 h-2.5" />
                            {hasDeadline ? 'Edit' : 'Set'} Deadline
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
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Main Layout ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Sidebar — Groups */}
          <div className="col-span-1 lg:col-span-3">
            <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-sm">
              <div className="p-4 border-b border-[var(--color-border)]">
                <h3 className="text-[var(--color-text-900)]">Groups</h3>
                {courseType && (
                  <p className="text-xs text-[var(--color-text-600)] mt-0.5">CPIS-{courseType}</p>
                )}
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {supervisorTree.length === 0 && (
                  <p className="p-4 text-[var(--color-text-600)] text-sm">No groups found</p>
                )}
                {supervisorTree.map(supervisor => (
                  <div key={supervisor.id}>
                    <div
                      className="p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--color-surface-alt)] transition-colors"
                      onClick={() => toggleSupervisor(supervisor.id)}
                    >
                      <span className="text-sm text-[var(--color-text-900)]">{supervisor.name}</span>
                      {expandedSupervisors.has(supervisor.id)
                        ? <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />
                        : <ChevronRight className="w-4 h-4 text-[var(--color-text-600)]" />}
                    </div>
                    {expandedSupervisors.has(supervisor.id) && (
                      <div className="bg-[var(--color-surface-alt)] divide-y divide-[var(--color-border)]">
                        {supervisor.groups.length === 0 && (
                          <p className="p-3 pl-8 text-[var(--color-text-600)] text-xs">No groups assigned</p>
                        )}
                        {supervisor.groups.map(group => (
                          <div
                            key={group.id}
                            className={`p-3 pl-8 cursor-pointer hover:bg-[var(--color-border)] transition-colors ${
                              selectedGroup === group.id
                                ? 'bg-[var(--color-primary-100)] border-l-4 border-[var(--color-primary-600)]'
                                : ''
                            }`}
                            onClick={() => setSelectedGroup(group.id)}
                          >
                            <div className="text-sm font-medium text-[var(--color-text-900)]">{group.groupCode}</div>
                            <div className="text-xs text-[var(--color-text-600)] mt-0.5 truncate">{group.projectName}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main content — 16 week cards */}
          <div className="col-span-1 lg:col-span-9">
            {selectedGroup ? (
              <>
                <div className="mb-4">
                  <h2 className="text-[var(--color-text-900)] mb-1">
                    {currentGroup ? `${currentGroup.groupCode} — ${currentGroup.projectName}` : ''}
                  </h2>
                  <p className="text-[var(--color-text-600)] text-sm">View weekly progress reports</p>
                </div>

                {reportsLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {weeks.map(wn => (
                      <div key={wn} className="h-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)] animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {weeks.map(weekNum => {
                      const report              = getReportForWeek(weekNum);
                      const ws                  = weekStatuses.find(s => s.weekNumber === weekNum);
                      const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                      const studentSubmitted     = report?.submissionStatus === 'submitted';
                      const supervisorResponded  = report?.supervisorResponseStatus === 'responded';

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
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border ${CARD_STATUS_STYLES[display]}`}>
                              {ws?.isLocked && <Lock className="w-3 h-3" />}
                              {display === 'Upcoming' && <Calendar className="w-3 h-3" />}
                              {display}
                            </span>
                          </div>

                          {/* Submission window */}
                          {ws && (ws.openAt || ws.closeAt) && (
                            <div className="mb-3 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 space-y-0.5">
                              {ws.openAt && (
                                <p>
                                  <span className="font-medium">Opens:</span>{' '}
                                  {new Date(ws.openAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              )}
                              {ws.closeAt && (
                                <p>
                                  <span className="font-medium">Closes:</span>{' '}
                                  {new Date(ws.closeAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                          )}

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

                          {/* Submission / review status */}
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
                )}
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
      </div>

      {/* ── Open Week Confirmation Dialog ───────────────────────────── */}
      <AlertDialog open={!!openTarget} onOpenChange={open => !open && setOpenTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-green-600" />
              Open Week {openTarget?.weekNumber}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-gray-600">
                <p>
                  This will open <strong>Week {openTarget?.weekNumber}</strong> for student submissions
                  in <strong>CPIS-{courseType}</strong>.
                </p>
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-amber-800">
                    An email notification will be sent to all students enrolled in this course,
                    informing them that Week {openTarget?.weekNumber} is now open for submission.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-green-600 hover:bg-green-700"
              onClick={handleOpenConfirmed}
            >
              <Unlock className="w-4 h-4 mr-1.5" />
              Open & Notify Students
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Deadline Config Dialog ───────────────────────────────────── */}
      {deadlineWeek && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDeadlineWeek(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface-white)] rounded-xl shadow-2xl w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <h2 className="text-[var(--color-text-900)] font-semibold">
                    Week {deadlineWeek.weekNumber} — Submission Window
                  </h2>
                </div>
                <button
                  onClick={() => setDeadlineWeek(null)}
                  className="text-[var(--color-text-400)] hover:text-[var(--color-text-700)] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Current status */}
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-600)]">
                  <span>Current status:</span>
                  <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${WEEK_STATUS_STYLES[getDisplayStatus(deadlineWeek)]}`}>
                    {getDisplayStatus(deadlineWeek)}
                  </span>
                </div>

                {/* Existing window summary */}
                {(deadlineWeek.openAt || deadlineWeek.closeAt) && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm space-y-1">
                    {deadlineWeek.openAt && (
                      <p className="text-blue-800">
                        <span className="font-medium">Opens:</span>{' '}
                        {new Date(deadlineWeek.openAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                    {deadlineWeek.closeAt && (
                      <p className="text-blue-800">
                        <span className="font-medium">Closes:</span>{' '}
                        {new Date(deadlineWeek.closeAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                  </div>
                )}

                {/* Open date/time */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-700)]">
                    Submission Opens
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DatePicker
                        value={dlOpenAt.split('T')[0] ?? ''}
                        onChange={date => {
                          setDlOpenAt(date + 'T' + (dlOpenAt.split('T')[1] ?? '08:00'));
                          if (dlCloseAt.split('T')[0] && date > dlCloseAt.split('T')[0]) {
                            setDlCloseAt('');
                          }
                        }}
                        placeholder="Select date"
                      />
                    </div>
                    <TimePicker
                      value={dlOpenAt.split('T')[1] ?? ''}
                      onChange={time => setDlOpenAt((dlOpenAt.split('T')[0] ?? '') + 'T' + time)}
                      placeholder="Time"
                    />
                  </div>
                </div>

                {/* Close date/time */}
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-[var(--color-text-700)]">
                    Submission Deadline <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <DatePicker
                        value={dlCloseAt.split('T')[0] ?? ''}
                        onChange={date => setDlCloseAt(date + 'T' + (dlCloseAt.split('T')[1] ?? '23:59'))}
                        minDate={dlOpenAt.split('T')[0] || undefined}
                        placeholder="Select date"
                      />
                    </div>
                    <TimePicker
                      value={dlCloseAt.split('T')[1] ?? ''}
                      onChange={time => setDlCloseAt((dlCloseAt.split('T')[0] ?? '') + 'T' + time)}
                      placeholder="Time"
                    />
                  </div>
                  <p className="text-xs text-[var(--color-text-500)]">
                    Students will be notified by email when this week is opened.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-between pt-2">
                  {(deadlineWeek.openAt || deadlineWeek.closeAt) ? (
                    <button
                      onClick={() => handleClearDeadline(deadlineWeek)}
                      className="text-xs text-red-600 hover:text-red-700 underline"
                    >
                      Clear deadline
                    </button>
                  ) : <span />}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setDeadlineWeek(null)}>Cancel</Button>
                    <Button
                      onClick={handleSaveDeadline}
                      disabled={dlSaving}
                      className="bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {dlSaving ? 'Saving…' : 'Save Window'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Report Detail Modal ──────────────────────────────────────── */}
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
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)] w-1/3">Week #</td>
                        <td className="p-4 text-[var(--color-text-900)]">{selectedReport.weekNumber}</td>
                      </tr>
                      <tr>
                        <td className="p-4 bg-[var(--color-surface-alt)] text-[var(--color-text-900)]">All members attended?</td>
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
