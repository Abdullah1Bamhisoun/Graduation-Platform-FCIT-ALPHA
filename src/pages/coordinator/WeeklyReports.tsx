import { useState, useEffect, useCallback } from 'react';
import { Layout } from '../../components/layout/Layout';
import { useAuth } from '../../lib/AuthContext';
import { supabase } from '../../lib/supabase';
import { FileText, RefreshCw, Unlock, EyeOff, Lock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import {
  getWeekStatuses,
  getDisplayStatus,
  openWeek,
  closeWeek,
} from '../../services/week-statuses';
import type { WeekStatus, WeekDisplayStatus } from '../../types';

interface Report {
  id: string;
  groupId: string;
  groupCode: string | null;
  weekNumber: number;
  dateRange: string;
  progressStatus: string;
  status: string;
  submittedAt: string;
}

const STATUS_STYLES: Record<WeekDisplayStatus, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-300',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-300',
  'Locked':     'bg-red-100 text-red-700 border-red-300',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
};

const SEMESTER = 'DEFAULT';

export function CoordinatorWeeklyReports() {
  const { user } = useAuth();

  // ── Reports state ────────────────────────────────────────────────────────
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Week control state ───────────────────────────────────────────────────
  const [weekStatuses, setWeekStatuses]           = useState<WeekStatus[]>([]);
  const [weekLoading, setWeekLoading]             = useState(true);
  const [courseType, setCourseType]               = useState<'498' | '499' | null>(null);
  const [weekActionLoading, setWeekActionLoading] = useState<string | null>(null);
  const [weekPanelOpen, setWeekPanelOpen]         = useState(true);

  // ── Load reports ─────────────────────────────────────────────────────────
  const loadReports = useCallback(async () => {
    if (!user?.coordinatorCourseId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_reports')
        .select('id, group_id, week_number, date_range, progress_status, status, submitted_at, groups(group_code)')
        .eq('course_id', user.coordinatorCourseId)
        .order('submitted_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setReports(
        (data || []).map((r: any) => ({
          id: r.id,
          groupId: r.group_id,
          groupCode: r.groups?.group_code ?? null,
          weekNumber: r.week_number,
          dateRange: r.date_range,
          progressStatus: r.progress_status,
          status: r.status,
          submittedAt: r.submitted_at,
        }))
      );
    } catch (err) {
      console.error('Error loading weekly reports:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.coordinatorCourseId]);

  // ── Load week statuses ───────────────────────────────────────────────────
  const loadWeekStatuses = useCallback(async (ct: '498' | '499') => {
    setWeekLoading(true);
    try {
      const dept = user?.department ?? 'IS';
      const statuses = await getWeekStatuses(ct, SEMESTER, dept);
      setWeekStatuses(statuses);
    } catch (err) {
      console.error('Failed to load week statuses:', err);
      setWeekStatuses([]);
    } finally {
      setWeekLoading(false);
    }
  }, [user?.department]);

  // ── Resolve course type from coordinator's course UUID ───────────────────
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
      loadReports();
      loadWeekStatuses(ct);
    })();
  }, [user?.coordinatorCourseId, loadReports, loadWeekStatuses]);

  // ── Week actions ─────────────────────────────────────────────────────────
  const handleOpen = async (ws: WeekStatus) => {
    if (!user) return;
    setWeekActionLoading(ws.id);
    try {
      await openWeek(ws.id, user.id);
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

  const statusColor: Record<string, string> = {
    excellent:         'text-green-700 bg-green-100',
    good:              'text-blue-700 bg-blue-100',
    satisfactory:      'text-amber-700 bg-amber-100',
    needs_improvement: 'text-red-700 bg-red-100',
  };

  const openedCount = weekStatuses.filter(ws => ws.wasOpened).length;

  return (
    <Layout user={user!} pageTitle="Weekly Reports">
      <div className="space-y-6">

        {/* ── Week Control Panel ─────────────────────────────────────── */}
        <div className="bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--color-surface-alt)] transition-colors"
            onClick={() => setWeekPanelOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <Lock className="w-4 h-4 text-[var(--color-text-600)]" />
              <span className="font-medium text-[var(--color-text-900)]">Week Control</span>
              <span className="text-xs text-[var(--color-text-600)] bg-[var(--color-surface-alt)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
                {openedCount} / 16 activated
              </span>
              {courseType && (
                <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  CPIS-{courseType}
                </span>
              )}
            </div>
            {weekPanelOpen
              ? <ChevronUp className="w-4 h-4 text-[var(--color-text-600)]" />
              : <ChevronDown className="w-4 h-4 text-[var(--color-text-600)]" />}
          </button>

          {weekPanelOpen && (
            <div className="border-t border-[var(--color-border)] p-5">
              {weekLoading ? (
                <p className="text-sm text-[var(--color-text-600)] text-center py-4">
                  Loading week statuses…
                </p>
              ) : weekStatuses.length === 0 ? (
                <p className="text-sm text-[var(--color-text-600)] text-center py-4">
                  No week data found.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {Array.from({ length: 16 }, (_, i) => i + 1).map(wn => {
                    const ws = weekStatuses.find(s => s.weekNumber === wn);
                    const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                    const busy = ws && weekActionLoading === ws.id;

                    return (
                      <div
                        key={wn}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-alt)]"
                      >
                        <span className="text-xs font-semibold text-[var(--color-text-700)]">W{wn}</span>
                        {ws?.isOpen && !ws?.isLocked && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full border font-medium leading-tight text-center bg-green-100 text-green-700 border-green-300">
                            Open
                          </span>
                        )}

                        {/* Actions */}
                        {ws && !ws.isLocked && !ws.isOpen && (
                          <button
                            disabled={!!busy}
                            onClick={() => handleOpen(ws)}
                            className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-green-300 text-green-700 bg-green-50 hover:bg-green-100 disabled:opacity-50 transition-colors"
                          >
                            <Unlock className="w-2.5 h-2.5" />
                            Open
                          </button>
                        )}
                        {ws && !ws.isLocked && ws.isOpen && (
                          <button
                            disabled={!!busy}
                            onClick={() => handleClose(ws)}
                            className="w-full text-xs flex items-center justify-center gap-1 px-1.5 py-1 rounded border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                          >
                            <EyeOff className="w-2.5 h-2.5" />
                            Close
                          </button>
                        )}
                        {(!ws || ws.isLocked) && (
                          <span className="text-xs text-[var(--color-text-500)] italic">
                            {ws?.isLocked ? 'Locked' : '—'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Reports Table ─────────────────────────────────────────── */}
        <div>
          <div className="flex justify-end mb-3">
            <Button variant="outline" size="sm" onClick={loadReports} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="text-center py-12 text-[var(--color-text-600)]">Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-12 text-[var(--color-text-600)]">No weekly reports for this course yet.</div>
          ) : (
            <div className="bg-[var(--color-surface-white)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Group</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Week</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Week Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Date Range</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Progress</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-[var(--color-text-600)]">Submitted</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {reports.map((r) => {
                    const ws = weekStatuses.find(s => s.weekNumber === r.weekNumber);
                    const display: WeekDisplayStatus = ws ? getDisplayStatus(ws) : 'Not Opened';
                    return (
                      <tr key={r.id} className="hover:bg-[var(--color-surface-alt)] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[var(--color-text-600)]" />
                            <span className="font-medium">{r.groupCode ?? r.groupId.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-600)]">Week {r.weekNumber}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[display]}`}>
                            {display}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-600)]">{r.dateRange}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[r.progressStatus] ?? 'bg-gray-100 text-gray-700'}`}>
                            {r.progressStatus.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface-alt)] text-[var(--color-text-600)] capitalize">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[var(--color-text-600)]">
                          {new Date(r.submittedAt).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
