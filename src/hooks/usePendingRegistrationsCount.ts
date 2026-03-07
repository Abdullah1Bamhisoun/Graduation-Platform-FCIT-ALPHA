import { useState, useEffect } from 'react';
import { getPendingRegistrationsViaAPI, subscribe } from '../lib/pending-registrations';
import type { User } from '../types';

/**
 * Returns the count of pending user registrations awaiting coordinator/admin approval.
 * Subscribes to live updates via the pending-registrations pub/sub channel.
 * Only meaningful for coordinator and admin roles.
 */
export function usePendingRegistrationsCount(user: User | null) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user || (user.activeRole !== 'coordinator' && user.activeRole !== 'admin')) {
      setPendingCount(0);
      return;
    }

    const load = () => {
      getPendingRegistrationsViaAPI(user.activeRole).then((regs) => setPendingCount(regs.length));
    };

    load();
    return subscribe(load);
  }, [user?.id, user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  return { pendingCount };
}
