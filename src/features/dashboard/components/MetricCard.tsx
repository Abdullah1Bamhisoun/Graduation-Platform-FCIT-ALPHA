import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: string;
    positive: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const iconStyles: Record<NonNullable<MetricCardProps['color']>, string> = {
  primary: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger:  'bg-red-50 text-red-500',
  info:    'bg-indigo-50 text-indigo-600',
};

export function MetricCard({ label, value, icon: Icon, trend, color = 'primary' }: MetricCardProps) {
  return (
    <div className="!bg-white rounded-xl border border-[var(--color-border)] p-6 flex flex-col gap-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default">
      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconStyles[color]}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-600)] mb-1">{label}</p>
        <p className="text-3xl font-bold text-[var(--color-text-900)] leading-none">{value}</p>
        {trend && (
          <p className={`mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
