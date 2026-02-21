import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { isEntityLocked, type LockEntityType } from '../services/platform-locks';

export interface LockStatus {
  isLocked: boolean;
  loading: boolean;
}

/**
 * Hook that returns the lock status for a given entity type (and optional entity ID).
 * Subscribes to real-time changes on the platform_locks table so all users
 * see updates immediately without refreshing.
 *
 * @param entityType  The module to check (e.g. 'weekly_reports', 'submissions')
 * @param entityId    Optional specific entity UUID. If omitted, checks the type-wide lock.
 */
export function useLockStatus(entityType: LockEntityType, entityId?: string): LockStatus {
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Initial fetch
    isEntityLocked(entityType, entityId).then((locked) => {
      if (!cancelled) {
        setIsLocked(locked);
        setLoading(false);
      }
    });

    // Real-time subscription: re-check whenever platform_locks changes
    const channel = supabase
      .channel(`lock:${entityType}:${entityId ?? 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_locks' },
        () => {
          isEntityLocked(entityType, entityId).then((locked) => {
            if (!cancelled) setIsLocked(locked);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [entityType, entityId]);

  return { isLocked, loading };
}
