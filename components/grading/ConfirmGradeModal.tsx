import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfirmGradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  variant?: 'default' | 'warning' | 'success' | 'info';
  confirmText?: string;
  cancelText?: string;
  details?: string[];
  showIcon?: boolean;
}

export function ConfirmGradeModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  variant = 'default',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  details = [],
  showIcon = true,
}: ConfirmGradeModalProps) {
  const variantConfig = {
    default: {
      icon: CheckCircle,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
    warning: {
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      buttonClass: 'bg-amber-600 hover:bg-amber-700',
    },
    success: {
      icon: CheckCircle,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      buttonClass: 'bg-green-600 hover:bg-green-700',
    },
    info: {
      icon: Info,
      iconColor: 'text-blue-600',
      iconBg: 'bg-blue-100',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  const config = variantConfig[variant];
  const Icon = config.icon;

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-4">
            {showIcon && (
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', config.iconBg)}>
                <Icon className={cn('w-6 h-6', config.iconColor)} />
              </div>
            )}
            <div className="flex-1">
              <DialogTitle className="text-xl">{title}</DialogTitle>
              <DialogDescription className="mt-2 text-base">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {details.length > 0 && (
          <div className="py-4">
            <p className="text-[var(--color-text-600)] mb-2">This action will:</p>
            <ul className="list-disc list-inside space-y-1 text-[var(--color-text-600)]">
              {details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-initial"
          >
            {cancelText}
          </Button>
          <Button 
            onClick={handleConfirm}
            className={cn('text-white flex-1 sm:flex-initial', config.buttonClass)}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
