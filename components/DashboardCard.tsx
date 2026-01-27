import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string | ReactNode;
  icon?: LucideIcon;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function DashboardCard({ title, icon: Icon, children, actions, className = '' }: DashboardCardProps) {
  return (
    <div className={`!bg-white rounded-lg border-[1.5px] border-[var(--color-border)] ${className}`}>
      <div className="flex items-center justify-between p-6 border-b-[1.5px] border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-[var(--color-primary-600)]" />}
          <h2 className="text-[var(--color-text-900)]">{title}</h2>
        </div>
        {actions && <div>{actions}</div>}
      </div>
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
