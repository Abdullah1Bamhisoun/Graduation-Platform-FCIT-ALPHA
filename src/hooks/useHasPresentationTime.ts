import { useState, useEffect, useCallback } from 'react';
import { getStudentPresentationView } from '../services/presentations';
import type { User } from '../types';

const storageKey = (userId: string) => `presentation_time_seen_${userId}`;
const SEEN_EVENT = 'presentation-time-mark-seen';

/**
 * Student-only: returns whether to show a red dot on the sidebar's
 * Presentation Time item. The dot appears once a presentation is assigned
 * and disappears after the student visits the Presentation Time page.
 *
 * "Seen" is tracked per-presentation via localStorage (keyed on the
 * scheduledAt timestamp), so re-scheduling produces a new dot.
 */
export function useHasPresentationTime(user: User | null) {
  const [hasPresentationTime, setHasPresentationTime] = useState(false);

  const compute = useCallback(async () => {
    if (!user || user.activeRole !== 'student') {
      setHasPresentationTime(false);
      return;
    }
    try {
      const view = await getStudentPresentationView();
      const scheduledAt = view.schedule?.scheduledAt ?? null;
      if (!scheduledAt) {
        setHasPresentationTime(false);
        return;
      }
      const lastSeen = localStorage.getItem(storageKey(user.id));
      setHasPresentationTime(lastSeen !== scheduledAt);
    } catch {
      setHasPresentationTime(false);
    }
  }, [user?.id, user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    compute();
  }, [compute]);

  // Listen for markAsSeen calls from any hook instance in the same tab
  useEffect(() => {
    const handler = () => setHasPresentationTime(false);
    window.addEventListener(SEEN_EVENT, handler);
    return () => window.removeEventListener(SEEN_EVENT, handler);
  }, []);

  /**
   * Call when the student lands on the Presentation Time page so the dot
   * disappears. Persists the current scheduledAt to localStorage so the dot
   * only re-appears when the schedule changes.
   */
  const markAsSeen = useCallback(async () => {
    if (!user || user.activeRole !== 'student') return;
    try {
      const view = await getStudentPresentationView();
      const scheduledAt = view.schedule?.scheduledAt;
      if (scheduledAt) {
        localStorage.setItem(storageKey(user.id), scheduledAt);
      }
    } catch {
      // Non-fatal; just hide the dot for this session
    }
    setHasPresentationTime(false);
    window.dispatchEvent(new Event(SEEN_EVENT));
  }, [user?.id, user?.activeRole]); // eslint-disable-line react-hooks/exhaustive-deps

  return { hasPresentationTime, markAsSeen };
}
