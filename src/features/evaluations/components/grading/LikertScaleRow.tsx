import { cn } from '../../../../utils';

interface LikertScaleRowProps {
  label: string;
  name: string;
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  maxScore: number;
  scaledScore?: number;
  showScore?: boolean;
  className?: string;
  variant?: 'default' | 'striped';
}

export function LikertScaleRow({
  label,
  name,
  value,
  onChange,
  disabled = false,
  maxScore,
  scaledScore,
  showScore = true,
  className,
  variant = 'default',
}: LikertScaleRowProps) {
  return (
    <tr
      className={cn(
        'border-b border-[var(--color-border)] transition-colors',
        variant === 'striped' && 'bg-[var(--color-surface-alt)]',
        !disabled && 'hover:bg-blue-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <td className="py-4 px-4 text-[var(--color-text-900)]">
        <div className="flex items-center gap-2">
          <span>{label}</span>
          {disabled && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              Locked
            </span>
          )}
        </div>
      </td>
      
      {[1, 2, 3, 4, 5].map((radioValue) => (
        <td key={radioValue} className="text-center py-4 px-4">
          <label
            className={cn(
              'flex items-center justify-center cursor-pointer group',
              disabled && 'cursor-not-allowed'
            )}
          >
            <input
              type="radio"
              name={name}
              value={radioValue}
              checked={value === radioValue}
              onChange={() => !disabled && onChange(radioValue)}
              disabled={disabled}
              className={cn(
                'w-5 h-5 cursor-pointer transition-all',
                'accent-[var(--color-primary-600)]',
                'focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-2',
                !disabled && 'hover:scale-110',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            />
          </label>
        </td>
      ))}
      
      {showScore && (
        <td className="text-center py-4 px-4 text-[var(--color-text-900)]">
          <span className={cn(
            'inline-block px-3 py-1 rounded-full',
            value && 'bg-green-50 text-green-700 border border-green-200',
            !value && 'text-[var(--color-text-400)]'
          )}>
            {scaledScore !== undefined ? scaledScore.toFixed(1) : (value || 0)} / {maxScore}
          </span>
        </td>
      )}
    </tr>
  );
}
