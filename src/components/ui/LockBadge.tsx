import { Lock, Unlock } from 'lucide-react';

/**
 * Compact inline badge for tables, cards, and headers.
 * Shows lock or open state.
 */
export function LockBadge({ locked }: { locked: boolean }) {
  if (locked) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700 border border-red-300">
        <Lock className="w-3 h-3" />
        Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 border border-green-300">
      <Unlock className="w-3 h-3" />
      Open
    </span>
  );
}
