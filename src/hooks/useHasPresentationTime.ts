import { useState, useEffect } from 'react';
import { getStudentPresentationView } from '../services/presentations';
import type { User } from '../types';

/**
 * Student-only: returns true once the student has a confirmed presentation
 * time assigned (used to show a red dot on the sidebar's Presentation Time
 * item so they know to check it).
 */
export function useHasPresentationTime(user: User | null) {
  const [hasPresentationTime, setHasPresentationTime] = useState(false);

  useEffect(() => {
    if (!user || user.activeRole !== 'student') {
      setHasPresentationTime(false);
      return;
    }
    let cancelled = false;
    getStudentPresentationView()
      .then((view) => {
        if (cancelled) return;
        setHasPresentationTime(!!view.schedule);
      })
      .catch(() => {
        if (!cancelled) setHasPresentationTime(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.activeRole]);

  return { hasPresentationTime };
}
