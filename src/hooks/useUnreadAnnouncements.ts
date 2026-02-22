import { useState, useEffect, useCallback } from 'react';
import { getAnnouncementsForRole } from '../services/announcements';
import type { User } from '../types';

const storageKey = (userId: string) => `announcements_last_visit_${userId}`;

/**
 * Returns the number of announcements published since the user last visited
 * the Announcements page. Uses localStorage to persist the last-visit timestamp.
 *
 * Only meaningful for consumer roles (student, supervisor).
 * Coordinators / admins create announcements — badge not relevant for them.
 */
export function useUnreadAnnouncements(user: User | null) {
  const [unreadCount, setUnreadCount] = useState(0);

  const compute = useCallback(async () => {
    if (!user || user.activeRole === 'coordinator' || user.activeRole === 'admin') {
      setUnreadCount(0);
      return;
    }
    const announcements = await getAnnouncementsForRole(user.activeRole);
    const lastVisitStr = localStorage.getItem(storageKey(user.id));
    const lastVisit = lastVisitStr ? new Date(lastVisitStr) : new Date(0);
    const count = announcements.filter(
      (a) => new Date(a.publishedAt) > lastVisit
    ).length;
    setUnreadCount(count);
  }, [user?.id, user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    compute();
  }, [compute]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    localStorage.setItem(storageKey(user.id), new Date().toISOString());
    setUnreadCount(0);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCount, markAllRead };
}
