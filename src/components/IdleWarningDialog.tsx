import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';

interface IdleWarningDialogProps {
  open: boolean;
  /** Seconds remaining when the dialog opens (matches warningMs / 1000) */
  initialSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

/**
 * Warning dialog shown when the user has been idle for nearly 30 minutes.
 * Displays a live countdown and lets the user either stay logged in or
 * log out immediately.
 */
export function IdleWarningDialog({
  open,
  initialSeconds,
  onStayLoggedIn,
  onLogout,
}: IdleWarningDialogProps) {
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  // Reset countdown whenever the dialog (re-)opens
  useEffect(() => {
    if (!open) return;
    setSecondsLeft(initialSeconds);

    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); return 0; }
        return s - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open, initialSeconds]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')} minutes`
    : `${seconds} second${seconds !== 1 ? 's' : ''}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onStayLoggedIn(); }}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="max-w-sm"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-amber-500 text-xl">&#9888;</span>
            Session Expiring Soon
          </DialogTitle>
          <DialogDescription className="text-[var(--color-text-700)] pt-1">
            You have been inactive for a while. For security, your session will
            automatically end in{' '}
            <span className="font-semibold text-[var(--color-text-900)]">
              {formatted}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-2 flex flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onLogout} className="w-full sm:w-auto">
            Log Out Now
          </Button>
          <Button onClick={onStayLoggedIn} className="w-full sm:w-auto">
            Stay Logged In
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
