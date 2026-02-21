import { Lock } from 'lucide-react';

/**
 * Full-width banner displayed at the top of a page/section when locked by Admin.
 * Use alongside useLockStatus():
 *
 *   const { isLocked } = useLockStatus('weekly_reports');
 *   {isLocked && <LockedBanner />}
 */
export function LockedBanner() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 mb-6">
      <Lock className="w-5 h-5 text-red-600 flex-shrink-0" />
      <div>
        <p className="font-medium text-red-800">This section is locked by Admin.</p>
        <p className="text-sm text-red-600">All editing has been disabled. Contact your admin to unlock.</p>
      </div>
    </div>
  );
}
