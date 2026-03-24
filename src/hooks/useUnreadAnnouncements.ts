import { useState, useEffect, useCallback } from 'react';
import { getAnnouncementsForRole } from '../services/announcements';
import type { User } from '../types';

const storageKey = (userId: string) => `announcements_last_visit_${userId}`;

// Custom event so all hook instances (Sidebar + page) stay in sync within the same tab
const MARK_READ_EVENT = 'announcements-mark-read';

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

  // Listen for markAllRead calls from any hook instance in the same tab
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.userId === user?.id) {
        setUnreadCount(0);
      }
    };
    window.addEventListener(MARK_READ_EVENT, handler);
    return () => window.removeEventListener(MARK_READ_EVENT, handler);
  }, [user?.id]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    localStorage.setItem(storageKey(user.id), new Date().toISOString());
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent(MARK_READ_EVENT, { detail: { userId: user.id } }));
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return { unreadCount, markAllRead };
}
