import { cn } from '../../lib/utils';
import { Download, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface RubricBreakdownItem {
  name: string;
  score: number;
  max: number;
  color?: string;
}

interface RubricSummaryCardProps {
  title: string;
  total: number;
  maxTotal: number;
  breakdown: RubricBreakdownItem[];
  onExport?: (format: 'pdf' | 'csv') => void;
  showExport?: boolean;
  variant?: 'default' | 'gradient';
  className?: string;
}

export function RubricSummaryCard({
  title,
  total,
  maxTotal,
  breakdown,
  onExport,
  showExport = true,
  variant = 'gradient',
  className,
}: RubricSummaryCardProps) {
  const percentage = maxTotal > 0 ? (total / maxTotal) * 100 : 0;

  const getGradeColor = () => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 80) return 'text-blue-600';
    if (percentage >= 70) return 'text-yellow-600';
    if (percentage >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div
      className={cn(
        'bg-[var(--color-surface-white)] rounded-xl border border-[var(--color-border)] shadow-md p-6',
        'transition-all hover:shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[var(--color-text-900)]">{title}</h3>
        {showExport && onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="w-4 h-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Total Score */}
      <div
        className={cn(
          'text-center mb-6 p-6 rounded-lg border',
          variant === 'gradient'
            ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200'
            : 'bg-[var(--color-surface-alt)] border-[var(--color-border)]'
        )}
      >
        <p className="text-[var(--color-text-600)] mb-2">Current Total</p>
        <p className={cn('text-5xl mb-2 transition-colors', getGradeColor())}>
          {total.toFixed(1)}
        </p>
        <p className="text-[var(--color-text-600)]">out of {maxTotal}</p>
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className={cn('text-2xl transition-colors', getGradeColor())}>
            {percentage.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        <h4 className="text-[var(--color-text-900)] mb-3">Breakdown</h4>
        {breakdown.map((item, idx) => {
          const itemPercentage = item.max > 0 ? (item.score / item.max) * 100 : 0;
          const progressColor = item.color || 'from-[var(--color-primary-600)] to-blue-500';
          
          return (
            <div key={idx} className="group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[var(--color-text-900)] text-sm group-hover:text-[var(--color-primary-600)] transition-colors">
                  {item.name}
                </span>
                <span className="text-[var(--color-text-600)] text-sm">
                  {item.score.toFixed(1)} / {item.max}
                </span>
              </div>
              <div className="h-2 bg-[var(--color-surface-alt)] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full bg-gradient-to-r transition-all duration-500 ease-out',
                    `bg-gradient-to-r ${progressColor}`
                  )}
                  style={{ width: `${Math.min(itemPercentage, 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="mt-6 pt-6 border-t border-[var(--color-border)] grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-[var(--color-text-600)] text-xs mb-1">Completed</p>
          <p className="text-[var(--color-text-900)] text-lg">
            {breakdown.filter(item => item.score > 0).length} / {breakdown.length}
          </p>
        </div>
        <div>
          <p className="text-[var(--color-text-600)] text-xs mb-1">Average</p>
          <p className="text-[var(--color-text-900)] text-lg">
            {breakdown.length > 0
              ? ((breakdown.reduce((sum, item) => sum + (item.max > 0 ? (item.score / item.max) * 100 : 0), 0) / breakdown.length)).toFixed(0)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}
