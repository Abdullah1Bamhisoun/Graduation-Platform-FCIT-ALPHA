import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  const start = new Date(firstDay);
  start.setDate(start.getDate() - start.getDay());

  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (weeks.length < 6) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur.getMonth() !== month && cur.getFullYear() >= year) break;
  }
  return weeks;
}

/** Format a Date as YYYY-MM-DD (local time). */
function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse a YYYY-MM-DD string as a local date (midnight). */
function fromYMD(ymd: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Display label like "Apr 5, 2026" */
function formatLabel(ymd: string): string {
  const d = fromYMD(ymd);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface DatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  placeholder?: string;
  minDate?: string; // 'YYYY-MM-DD' — dates before this are disabled
  maxDate?: string; // 'YYYY-MM-DD' — dates after this are disabled
}

export function DatePicker({ value, onChange, placeholder = 'Select date', minDate, maxDate }: DatePickerProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const d = fromYMD(value);
    return d ? d.getFullYear() : today.getFullYear();
  });
  const [viewMonth, setViewMonth] = useState(() => {
    const d = fromYMD(value);
    return d ? d.getMonth() : today.getMonth();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync view to value when it changes externally
  useEffect(() => {
    const d = fromYMD(value);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectedDate = fromYMD(value);
  const todayYMD = toYMD(today);
  const minYMD = minDate ?? null;
  const maxYMD = maxDate ?? null;

  const isDisabled = (ymd: string) =>
    (minYMD !== null && ymd < minYMD) || (maxYMD !== null && ymd > maxYMD);

  const handleSelect = (day: Date) => {
    if (isDisabled(toYMD(day))) return;
    onChange(toYMD(day));
    setOpen(false);
  };

  const label = value ? formatLabel(value) : placeholder;
  const weeks = getCalendarWeeks(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white hover:bg-gray-50 transition-colors w-full text-left"
      >
        <Calendar className="w-4 h-4 text-[var(--color-text-600)] flex-shrink-0" />
        <span className={value ? 'text-[var(--color-text-900)]' : 'text-[var(--color-text-600)]'}>
          {label}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-[var(--color-border)] rounded-xl shadow-lg p-4 w-72 select-none">
          {/* Month / Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-[var(--color-text-600)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-[var(--color-text-900)]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-[var(--color-text-600)]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_HEADERS.map(d => (
              <div key={d} className="text-center text-xs text-[var(--color-text-600)] py-1 font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="space-y-0.5">
            {weeks.map((week, i) => (
              <div key={i} className="grid grid-cols-7">
                {week.map((day, j) => {
                  const ymd = toYMD(day);
                  const isSelected = !!selectedDate && ymd === toYMD(selectedDate);
                  const isToday = ymd === todayYMD;
                  const inMonth = day.getMonth() === viewMonth;
                  const disabled = isDisabled(ymd);
                  return (
                    <button
                      key={j}
                      type="button"
                      onClick={() => handleSelect(day)}
                      disabled={disabled}
                      className={`text-center text-sm py-1.5 rounded-lg transition-colors ${
                        disabled
                          ? 'text-gray-300 cursor-not-allowed'
                          : isSelected
                          ? 'bg-[var(--color-primary-600)] text-white font-medium'
                          : isToday
                          ? 'bg-blue-50 text-[var(--color-primary-600)] font-bold hover:bg-blue-100'
                          : inMonth
                          ? 'text-[var(--color-text-900)] hover:bg-gray-100'
                          : 'text-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Clear / Today shortcuts */}
          <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="text-xs text-[var(--color-text-500)] hover:text-[var(--color-text-900)] hover:underline"
            >
              Clear
            </button>
            {!isDisabled(todayYMD) && (
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setViewYear(now.getFullYear());
                  setViewMonth(now.getMonth());
                  onChange(toYMD(now));
                  setOpen(false);
                }}
                className="text-xs text-[var(--color-primary-600)] hover:underline"
              >
                Today
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
