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
    <div className={`!bg-white rounded-xl border border-[var(--color-border)] shadow-sm ${className}`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-7 h-7 rounded-lg bg-[var(--color-primary-100)] flex items-center justify-center">
              <Icon className="w-3.5 h-3.5 text-[var(--color-primary-600)]" />
            </div>
          )}
          <h2 className="text-sm font-semibold text-[var(--color-text-900)]">{title}</h2>
        </div>
        {actions && <div>{actions}</div>}
      </div>

      {/* Card body */}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
