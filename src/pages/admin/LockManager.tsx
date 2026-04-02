import { useState, useEffect } from 'react';
import { Layout } from '../../components/layout/Layout';
import { Button } from '../../components/ui/button';
import { useAuth } from '../../lib/AuthContext';
import { getAllLocks, type PlatformLock, type LockEntityType } from '../../services/platform-locks';
import { supabase } from '../../lib/supabase';
import { apiUrl } from '@/lib/api';
import { Lock, Unlock, AlertTriangle, RefreshCw } from 'lucide-react';
import { LockBadge } from '../../components/ui/LockBadge';
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
import { toast } from 'sonner';

// ─── Module definitions ────────────────────────────────────────────────────

interface Module {
  entityType: LockEntityType;
  label: string;
  description: string;
  isGlobal?: boolean;
}

const MODULES: Module[] = [
  { entityType: 'weekly_reports',   label: 'Weekly Reports',        description: 'Student report submissions and supervisor responses' },
  { entityType: 'submissions',      label: 'Chapter Submissions',   description: 'Student chapter file uploads and submission creation' },
  { entityType: 'evaluations',      label: 'Evaluations',           description: 'Supervisor and committee evaluations' },
  { entityType: 'grades',           label: 'Grades',                description: 'Deliverable grading and assessment scores' },
  { entityType: 'announcements',    label: 'Announcements',         description: 'Creating, editing, and deleting announcements' },
  { entityType: 'milestones',       label: 'Milestones',            description: 'Milestone configuration and visibility changes' },
  { entityType: 'presentations',    label: 'Presentations',         description: 'Presentation scheduling and availability updates' },
  { entityType: 'important_files',  label: 'Important Files',       description: 'Uploading and editing important documents' },
  { entityType: 'groups',           label: 'Groups',                description: 'Group creation, editing, and supervisor assignment' },
  { entityType: 'all',              label: 'GLOBAL PLATFORM LOCK',  description: 'Locks ALL modules instantly. Overrides individual settings.', isGlobal: true },
];

// ─── Component ────────────────────────────────────────────────────────────

export function AdminLockManager() {
  const { user } = useAuth();
  const [locks, setLocks] = useState<PlatformLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirmation dialog state
  const [confirmTarget, setConfirmTarget] = useState<{ module: Module; toLock: boolean } | null>(null);

  const fetchLocks = async () => {
    try {
      const data = await getAllLocks();
      setLocks(data);
    } catch (err) {
      console.error('Failed to fetch locks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchLocks();

    // Real-time subscription — refresh when any lock changes
    const channel = supabase
      .channel('admin:platform_locks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_locks' }, fetchLocks)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!user) return null;

  // Build a map from entityType → lock record
  const lockMap = new Map<LockEntityType, PlatformLock>(
    locks.map((l) => [l.entityType, l])
  );

  const isModuleLocked = (entityType: LockEntityType): boolean => {
    const globalLock = lockMap.get('all');
    if (globalLock?.isLocked) return true;
    return lockMap.get(entityType)?.isLocked ?? false;
  };

  const getLockedBy = (entityType: LockEntityType): string | null => {
    const globalLock = lockMap.get('all');
    if (globalLock?.isLocked && entityType !== 'all') return globalLock.lockedByName ?? 'Admin';
    return lockMap.get(entityType)?.lockedByName ?? null;
  };

  const getLockedAt = (entityType: LockEntityType): string | null => {
    const globalLock = lockMap.get('all');
    if (globalLock?.isLocked && entityType !== 'all') return globalLock.lockedAt;
    return lockMap.get(entityType)?.lockedAt ?? null;
  };

  const handleToggle = (module: Module) => {
    const currently = isModuleLocked(module.entityType);
    setConfirmTarget({ module, toLock: !currently });
  };

  const handleConfirm = async () => {
    if (!confirmTarget || !user) return;
    const { module, toLock } = confirmTarget;
    setConfirmTarget(null);
    setActionLoading(module.entityType);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(apiUrl('/api/locks'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entityType: module.entityType,
          isLocked: toLock,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update lock');
      }

      toast.success(`"${module.label}" has been ${toLock ? 'locked' : 'unlocked'}.`);
      await fetchLocks();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update lock');
    } finally {
      setActionLoading(null);
    }
  };

  const lockedModulesCount = MODULES.filter(
    (m) => m.entityType !== 'all' && isModuleLocked(m.entityType)
  ).length;

  return (
    <Layout user={user} pageTitle="Lock Manager">

      {/* Info banner */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <AlertTriangle className="mt-0.5 w-5 h-5 text-blue-600 flex-shrink-0" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Admin Lock Controls</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-700">
            <li><strong>Lock</strong> — prevents all edits, submissions, and changes for that module. Admins are exempt.</li>
            <li><strong>Unlock</strong> — restores normal access immediately for all users.</li>
            <li><strong>Global Lock</strong> — instantly locks every module. Takes priority over individual settings.</li>
            <li>Changes are reflected in real-time across all active sessions.</li>
          </ul>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--color-text-600)]">
          {lockMap.get('all')?.isLocked
            ? '🔴 Global platform lock is ACTIVE — all modules are locked'
            : `${lockedModulesCount} of ${MODULES.length - 1} modules locked`}
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchLocks}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Modules table */}
      <div className="bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)]">
        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-12 gap-3 p-4 bg-[var(--color-surface-alt)] border-b border-[var(--color-border)] text-sm font-medium text-[var(--color-text-700)] rounded-t-xl">
          <div className="col-span-4">Module</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-2 text-center">Locked By</div>
          <div className="col-span-2 text-center">Locked At</div>
          <div className="col-span-2 text-right">Action</div>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {MODULES.map((module) => {
            const locked = isModuleLocked(module.entityType);
            const lockedBy = getLockedBy(module.entityType);
            const lockedAt = getLockedAt(module.entityType);
            const busy = actionLoading === module.entityType;
            const globalActive = lockMap.get('all')?.isLocked && module.entityType !== 'all';

            const actionBtn = globalActive ? (
              <span className="text-xs text-[var(--color-text-600)] italic">Controlled by Global Lock</span>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => handleToggle(module)}
                className={locked
                  ? 'text-green-600 border-green-300 hover:bg-green-50 h-7 text-xs'
                  : 'text-red-600 border-red-300 hover:bg-red-50 h-7 text-xs'
                }
              >
                {locked ? (
                  <><Unlock className="w-3 h-3 mr-1" />Unlock</>
                ) : (
                  <><Lock className="w-3 h-3 mr-1" />{module.isGlobal ? 'Lock All' : 'Lock'}</>
                )}
              </Button>
            );

            return (
              <div
                key={module.entityType}
                className={module.isGlobal ? 'bg-[var(--color-surface-alt)]' : ''}
              >
                {/* Mobile card */}
                <div className="sm:hidden p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`font-medium text-sm ${module.isGlobal ? 'text-red-700' : 'text-[var(--color-text-900)]'}`}>
                        {module.label}
                      </p>
                      <p className="text-xs text-[var(--color-text-600)] mt-0.5">{module.description}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <LockBadge locked={locked} />
                      {globalActive && (
                        <p className="text-xs text-red-600 mt-1 text-right">via Global</p>
                      )}
                    </div>
                  </div>
                  {(lockedBy || lockedAt) && (
                    <div className="text-xs text-[var(--color-text-600)] space-y-0.5">
                      {lockedBy && <p>By: {lockedBy}</p>}
                      {lockedAt && <p>At: {new Date(lockedAt).toLocaleString()}</p>}
                    </div>
                  )}
                  <div>{actionBtn}</div>
                </div>
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-12 gap-3 p-4 items-center">
                  <div className="col-span-4">
                    <p className={`font-medium text-sm ${module.isGlobal ? 'text-red-700' : 'text-[var(--color-text-900)]'}`}>
                      {module.label}
                    </p>
                    <p className="text-xs text-[var(--color-text-600)] mt-0.5">{module.description}</p>
                  </div>
                  <div className="col-span-2 text-center">
                    <LockBadge locked={locked} />
                    {globalActive && (
                      <p className="text-xs text-red-600 mt-1">via Global Lock</p>
                    )}
                  </div>
                  <div className="col-span-2 text-center text-[var(--color-text-600)] text-xs">
                    {lockedBy || '—'}
                  </div>
                  <div className="col-span-2 text-center text-[var(--color-text-600)] text-xs">
                    {lockedAt ? new Date(lockedAt).toLocaleString() : '—'}
                  </div>
                  <div className="col-span-2 text-right">
                    {actionBtn}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmation dialog */}
      <AlertDialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTarget?.toLock ? 'Lock' : 'Unlock'} "{confirmTarget?.module.label}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.toLock
                ? `This will immediately disable all edits and submissions for "${confirmTarget.module.label}". Admins remain unaffected. Users will see a "Locked by Admin" message.`
                : `This will restore normal access to "${confirmTarget?.module.label}" for all users immediately.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmTarget?.toLock ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-green-600 hover:bg-green-700 text-white'}
              onClick={handleConfirm}
            >
              {confirmTarget?.toLock ? 'Lock Now' : 'Unlock Now'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
