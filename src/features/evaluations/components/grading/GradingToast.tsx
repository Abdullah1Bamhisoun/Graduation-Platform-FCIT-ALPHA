import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface GradingToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function showGradingToast({
  title,
  message,
  type = 'success',
  duration = 3000,
  action,
}: GradingToastOptions) {
  const toastConfig = {
    duration,
    ...(action && {
      action: {
        label: action.label,
        onClick: action.onClick,
      },
    }),
  };

  switch (type) {
    case 'success':
      toast.success(title || 'Success', {
        description: message,
        ...toastConfig,
      });
      break;
    case 'error':
      toast.error(title || 'Error', {
        description: message,
        ...toastConfig,
      });
      break;
    case 'warning':
      toast.warning(title || 'Warning', {
        description: message,
        ...toastConfig,
      });
      break;
    case 'info':
      toast.info(title || 'Info', {
        description: message,
        ...toastConfig,
      });
      break;
  }
}

// Predefined grading toasts
export const GradingToasts = {
  gradeSaved: (chapterName?: string) =>
    showGradingToast({
      type: 'success',
      title: 'Grade Saved',
      message: chapterName ? `Grade for ${chapterName} has been saved successfully.` : 'Grade has been saved successfully.',
    }),

  gradeUpdated: (chapterName?: string) =>
    showGradingToast({
      type: 'success',
      title: 'Grade Updated',
      message: chapterName ? `Grade for ${chapterName} has been updated.` : 'Grade has been updated.',
    }),

  allGradesSaved: () =>
    showGradingToast({
      type: 'success',
      title: 'All Grades Saved',
      message: 'All grades have been saved successfully.',
      duration: 4000,
    }),

  missingGrades: () =>
    showGradingToast({
      type: 'warning',
      title: 'Incomplete Grading',
      message: 'Some chapters have not been graded yet. You can save as draft to complete later.',
      duration: 5000,
    }),

  invalidGrade: (max: number) =>
    showGradingToast({
      type: 'error',
      title: 'Invalid Grade',
      message: `Grade must be between 0 and ${max}.`,
    }),

  gradingLocked: () =>
    showGradingToast({
      type: 'warning',
      title: 'Grading Locked',
      message: 'This submission has been finalized and cannot be modified.',
    }),

  draftSaved: () =>
    showGradingToast({
      type: 'info',
      title: 'Draft Saved',
      message: 'Your grading progress has been saved as a draft.',
    }),

  evaluationApproved: () =>
    showGradingToast({
      type: 'success',
      title: 'Evaluation Approved',
      message: 'The evaluation has been approved and submitted successfully.',
      duration: 4000,
    }),

  changesRequested: () =>
    showGradingToast({
      type: 'warning',
      title: 'Changes Requested',
      message: 'Students have been notified about the requested changes.',
      duration: 4000,
    }),

  exportStarted: (format: string) =>
    showGradingToast({
      type: 'info',
      title: 'Export Started',
      message: `Preparing ${format.toUpperCase()} export...`,
      duration: 2000,
    }),

  exportCompleted: (format: string) =>
    showGradingToast({
      type: 'success',
      title: 'Export Complete',
      message: `${format.toUpperCase()} file has been downloaded.`,
    }),
};
