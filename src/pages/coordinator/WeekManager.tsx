import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../lib/AuthContext';
import { getWeekStatuses, getDisplayStatus, openWeek, closeWeek, lockWeek } from '../../services/week-statuses';
import { Lock, Unlock, EyeOff, AlertTriangle, Info } from 'lucide-react';
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
import type { WeekStatus } from '../../types';
import { toast } from 'sonner';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  'Open':       'bg-green-100 text-green-700 border-green-300',
  'Closed':     'bg-gray-100 text-gray-600 border-gray-300',
  'Locked':     'bg-red-100 text-red-700 border-red-300',
  'Not Opened': 'bg-slate-100 text-slate-400 border-slate-200',
};

type CourseTab = '498' | '499';
const SEMESTER = 'DEFAULT';

/** Hard cap on weekly marks per course */
const WEEKLY_MAX_MARKS: Record<CourseTab, number> = { '498': 20, '499': 22 };

// ─── Component ───────────────────────────────────────────────────────────────

export function CoordinatorWeekManager() {
  const { user } = useAuth();
  const [activeTab, setActiveTab]       = useState<CourseTab>('498');
  const [statuses498, setStatuses498]   = useState<WeekStatus[]>([]);
  const [statuses499, setStatuses499]   = useState<WeekStatus[]>([]);
  const [loading, setLoading]           = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Lock confirmation dialog
  const [lockTarget, setLockTarget]     = useState<WeekStatus | null>(null);

  const statuses = activeTab === '498' ? statuses498 : statuses499;

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [s498, s499] = await Promise.all([
          getWeekStatuses('498', SEMESTER),
          getWeekStatuses('499', SEMESTER),
        ]);
        setStatuses498(s498);
        setStatuses499(s499);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const refresh = async () => {
    const [s498, s499] = await Promise.all([
      getWeekStatuses('498', SEMESTER),
      getWeekStatuses('499', SEMESTER),
    ]);
    setStatuses498(s498);
    setStatuses499(s499);
  };

  const handleOpen = async (ws: WeekStatus) => {
    if (!user) return;
    setActionLoading(ws.id);
    try {
      await openWeek(ws.id, user.id);
      await refresh();
      toast.success(`Week ${ws.weekNumber} opened`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to open week');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClose = async (ws: WeekStatus) => {
    setActionLoading(ws.id);
    try {
      await closeWeek(ws.id);
      await refresh();
      toast.success(`Week ${ws.weekNumber} closed`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to close week');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLockConfirm = async () => {
    if (!lockTarget) return;
    setActionLoading(lockTarget.id);
    setLockTarget(null);
    try {
      await lockWeek(lockTarget.id);
      await refresh();
      toast.success(`Week ${lockTarget.weekNumber} locked permanently`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to lock week');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;
  if (loading) {
    return (
      <Layout user={user} pageTitle="Week Manager">
        <div className="p-6 text-[var(--color-text-600)]">Loading week statuses…</div>
      </Layout>
    );
  }

  const openedCount = statuses.filter(ws => ws.wasOpened).length;

  return (
    <Layout user={user} pageTitle="Week Manager">

      {/* Info banner */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <AlertTriangle className="mt-0.5 w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Coordinator Controls</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li><strong>Open</strong> — students can submit; marks was_opened = true permanently</li>
            <li><strong>Close</strong> — stops new submissions; missed weeks = 0/2</li>
            <li><strong>Lock</strong> — permanent, irreversible; late requests no longer accepted</li>
            <li>Weeks never opened are <strong>excluded</strong> from grade calculation</li>
          </ul>
        </div>
      </div>

      {/* Weekly cap rule banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <Info className="mt-0.5 w-5 h-5 text-amber-600 flex-shrink-0" />
        <div className="text-sm text-amber-800">
          <p className="font-medium mb-1">Weekly Mark Cap Rule</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-700">
            <li>Each week = <strong>2 marks</strong> (1 student submission + 1 supervisor response)</li>
            <li><strong>CPIS-499</strong>: maximum weekly grade = <strong>22 marks</strong> (cap reached after 11 full weeks)</li>
            <li><strong>CPIS-498</strong>: maximum weekly grade = <strong>20 marks</strong> (cap reached after 10 full weeks)</li>
            <li>Opening additional weeks after the cap is reached does <strong>not</strong> increase students' weekly grade</li>
          </ul>
        </div>
      </div>

      {/* Course tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(['498', '499'] as const).map(ct => (
          <button
            key={ct}
            onClick={() => setActiveTab(ct)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeTab === ct
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                : 'bg-[var(--color-surface-white)] text-[var(--color-text-700)] border-[var(--color-border)] hover:bg-[var(--color-surface-alt)]'
            }`}
          >
            CPIS-{ct}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-3 text-sm self-center">
          <span className="text-[var(--color-text-600)]">
            {openedCount} / 16 weeks activated
          </span>
          {(() => {
            const cap = WEEKLY_MAX_MARKS[activeTab];
            const marksAvailable = openedCount * 2;
            if (marksAvailable >= cap) {
              return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                  <Lock className="w-3 h-3" />
                  Weekly cap ({cap} marks) reachable
                </span>
              );
            }
            return (
              <span className="text-[var(--color-text-500)] text-xs">
                Max weekly marks so far: {marksAvailable}/{cap}
              </span>
            );
          })()}
        </div>
      </div>

      {/* Week table */}
      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
            <tr>
              <th className="p-4 text-left text-[var(--color-text-700)]">Week</th>
              <th className="p-4 text-center text-[var(--color-text-700)]">Status</th>
              <th className="p-4 text-center text-[var(--color-text-700)]">Opened At</th>
              <th className="p-4 text-center text-[var(--color-text-700)]">Closed At</th>
              <th className="p-4 text-right text-[var(--color-text-700)]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {statuses.map(ws => {
              const display  = getDisplayStatus(ws);
              const busy     = actionLoading === ws.id;

              return (
                <tr key={ws.id} className={!ws.wasOpened ? 'opacity-60' : ''}>
                  <td className="p-4 font-medium text-[var(--color-text-900)]">Week {ws.weekNumber}</td>
                  <td className="p-4 text-center">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-full border ${STATUS_STYLES[display]}`}>
                      {ws.isLocked && <Lock className="w-3 h-3" />}
                      {display}
                    </span>
                  </td>
                  <td className="p-4 text-center text-[var(--color-text-600)] text-xs">
                    {ws.openedAt ? new Date(ws.openedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4 text-center text-[var(--color-text-600)] text-xs">
                    {ws.closedAt ? new Date(ws.closedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      {/* Open button */}
                      {!ws.isOpen && !ws.isLocked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-600 border-green-300 hover:bg-green-50 h-7 text-xs"
                          disabled={busy}
                          onClick={() => handleOpen(ws)}
                        >
                          <Unlock className="w-3 h-3 mr-1" />
                          Open
                        </Button>
                      )}

                      {/* Close button */}
                      {ws.isOpen && !ws.isLocked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-gray-600 border-gray-300 hover:bg-gray-100 h-7 text-xs"
                          disabled={busy}
                          onClick={() => handleClose(ws)}
                        >
                          <EyeOff className="w-3 h-3 mr-1" />
                          Close
                        </Button>
                      )}

                      {/* Lock button — only if was opened, not yet locked */}
                      {ws.wasOpened && !ws.isLocked && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs"
                          disabled={busy}
                          onClick={() => setLockTarget(ws)}
                        >
                          <Lock className="w-3 h-3 mr-1" />
                          Lock
                        </Button>
                      )}

                      {ws.isLocked && (
                        <span className="text-xs text-[var(--color-text-600)] italic">Permanent</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Lock confirmation dialog */}
      <AlertDialog open={!!lockTarget} onOpenChange={open => !open && setLockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Lock Week {lockTarget?.weekNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action is <strong>permanent and irreversible</strong>. Once locked, students can no longer
              request late submissions for this week, and no further changes to its status are possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleLockConfirm}
            >
              Lock Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
