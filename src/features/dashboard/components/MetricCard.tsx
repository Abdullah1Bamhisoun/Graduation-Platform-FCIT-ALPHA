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

const colorClasses = {
  primary: '!bg-white text-purple-700',
  success: '!bg-white text-green-700',
  warning: '!bg-white text-amber-700',
  danger: '!bg-white text-red-700',
  info: '!bg-white text-blue-700',
};

export function MetricCard({ label, value, icon: Icon, trend, color = 'primary' }: MetricCardProps) {
  return (
    <div className="!bg-white rounded-lg border-[1.5px] border-[var(--color-border)] p-6 hover:border-[var(--color-primary-600)] transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[var(--color-text-600)] mb-2">{label}</p>
          <p className="text-[var(--color-text-900)]">{value}</p>
          {trend && (
            <p className={`mt-2 ${trend.positive ? 'text-green-600' : 'text-red-600'}`}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center border-[1.5px] ${color === 'primary' ? 'border-purple-500' : color === 'success' ? 'border-green-500' : color === 'warning' ? 'border-amber-500' : color === 'danger' ? 'border-red-500' : 'border-blue-500'}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}
