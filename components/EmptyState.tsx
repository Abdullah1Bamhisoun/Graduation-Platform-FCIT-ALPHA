import { LucideIcon } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-surface-alt)] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[var(--color-text-600)]" />
      </div>
      <h3 className="text-[var(--color-text-900)] mb-2">{title}</h3>
      <p className="text-[var(--color-text-600)] mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
