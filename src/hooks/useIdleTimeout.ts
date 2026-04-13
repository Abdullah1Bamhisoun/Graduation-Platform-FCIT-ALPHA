import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimeoutOptions {
  /** Total idle time before logout in ms. Default: 30 minutes */
  timeoutMs?: number;
  /** How long before timeout to fire onWarning in ms. Default: 2 minutes */
  warningMs?: number;
  /** Called when the warning window begins (timeoutMs - warningMs of inactivity) */
  onWarning: () => void;
  /** Called when the full timeout elapses with no activity */
  onTimeout: () => void;
  /** Set to false while the user is not authenticated to disable tracking */
  enabled?: boolean;
}

const IDLE_EVENTS = [
  'mousedown',
  'mousemove',
  'keydown',
  'scroll',
  'touchstart',
  'click',
  'visibilitychange',
] as const;

/**
 * Tracks user inactivity and fires callbacks before automatically logging out.
 *
 * Timeline (default):
 *   0 ─────── 28 min (onWarning) ─────── 30 min (onTimeout / logout)
 *
 * Any DOM activity resets both timers, including during the warning window.
 * Returns a `resetTimers` function so the "Stay logged in" button can
 * explicitly reset without waiting for a DOM event.
 */
export function useIdleTimeout({
  timeoutMs = 30 * 60 * 1000,   // 30 minutes
  warningMs = 2 * 60 * 1000,    // 2-minute warning window
  onWarning,
  onTimeout,
  enabled = true,
}: UseIdleTimeoutOptions) {
  // Keep stable refs to the callbacks so the effect never needs to re-run
  // when the parent re-renders.
  const onWarningRef = useRef(onWarning);
  const onTimeoutRef = useRef(onTimeout);
  onWarningRef.current = onWarning;
  onTimeoutRef.current = onTimeout;

  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimer.current) { clearTimeout(warningTimer.current); warningTimer.current = null; }
    if (logoutTimer.current)  { clearTimeout(logoutTimer.current);  logoutTimer.current  = null; }
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    warningTimer.current = setTimeout(() => onWarningRef.current(), timeoutMs - warningMs);
    logoutTimer.current  = setTimeout(() => onTimeoutRef.current(), timeoutMs);
  }, [clearTimers, timeoutMs, warningMs]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    const handleActivity = () => resetTimers();

    IDLE_EVENTS.forEach((ev) =>
      window.addEventListener(ev, handleActivity, { passive: true }),
    );

    // Start the initial countdown
    resetTimers();

    return () => {
      IDLE_EVENTS.forEach((ev) =>
        window.removeEventListener(ev, handleActivity),
      );
      clearTimers();
    };
  }, [enabled, resetTimers, clearTimers]);

  return { resetTimers };
}
