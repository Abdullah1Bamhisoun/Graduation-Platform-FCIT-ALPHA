import { cn } from '../../lib/utils';

interface TotalsChipProps {
  label: string;
  current: number;
  max: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  showPercentage?: boolean;
  className?: string;
}

export function TotalsChip({
  label,
  current,
  max,
  variant = 'default',
  size = 'md',
  showPercentage = false,
  className,
}: TotalsChipProps) {
  const percentage = max > 0 ? (current / max) * 100 : 0;

  const variantStyles = {
    default: 'bg-gray-50 text-gray-900 border-gray-200',
    primary: 'bg-blue-50 text-blue-900 border-blue-200',
    success: 'bg-green-50 text-green-900 border-green-200',
    warning: 'bg-amber-50 text-amber-900 border-amber-200',
    danger: 'bg-red-50 text-red-900 border-red-200',
  };

  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border transition-all',
        variantStyles[variant],
        sizeStyles[size],
        'hover:shadow-sm',
        className
      )}
    >
      <span className="opacity-80">{label}:</span>
      <span className="font-semibold">
        {current.toFixed(1)} / {max}
      </span>
      {showPercentage && (
        <span className="text-xs opacity-70">
          ({percentage.toFixed(0)}%)
        </span>
      )}
    </div>
  );
}
