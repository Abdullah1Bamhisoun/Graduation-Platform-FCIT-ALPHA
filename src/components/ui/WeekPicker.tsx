import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { dateToIsoWeek } from '../../services/presentations';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Convert ISO week string ("YYYY-Www") back to the Sunday that starts
 * the display week. In this app Sunday belongs to the *following* ISO week,
 * so the display-Sunday = ISO-Monday − 1 day.
 */
function isoWeekToSunday(weekStr: string): Date | null {
  const m = weekStr.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO Monday of week 1 of the given year
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // treat Sunday as 7
  const mondayW1 = new Date(jan4);
  mondayW1.setDate(jan4.getDate() - (dayOfWeek - 1));
  // Monday of the target week
  const monday = new Date(mondayW1);
  monday.setDate(mondayW1.getDate() + (week - 1) * 7);
  // Display-Sunday is the day before that Monday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() - 1);
  sunday.setHours(0, 0, 0, 0);
  return sunday;
}

/** Build 5-or-6 week rows for the calendar, each row starting on Sunday. */
function getCalendarWeeks(year: number, month: number): Date[][] {
  const firstDay = new Date(year, month, 1);
  // Rewind to the Sunday on or before the 1st
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
    // Stop once we've passed the last day of the month and finished the week
    if (cur.getMonth() !== month && cur.getFullYear() >= year) break;
  }
  return weeks;
}

interface WeekPickerProps {
  value: string; // 'YYYY-Www'
  onChange: (week: string) => void;
}

export function WeekPicker({ value, onChange }: WeekPickerProps) {
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
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

  const selectedSunday = isoWeekToSunday(value);

  const isSelectedWeek = (sunday: Date) =>
    !!selectedSunday && sunday.toDateString() === selectedSunday.toDateString();

  const isCurrentWeek = (sunday: Date) => {
    const todaySunday = isoWeekToSunday(dateToIsoWeek(today));
    return !!todaySunday && sunday.toDateString() === todaySunday.toDateString();
  };

  const handleSelectWeek = (sunday: Date) => {
    onChange(dateToIsoWeek(sunday));
    setOpen(false);
  };

  const label = /^\d{4}-W\d{2}$/.test(value)
    ? `Week ${parseInt(value.split('-W')[1], 10)} · ${value.split('-W')[0]}`
    : 'Select Week';

  const weeks = getCalendarWeeks(viewYear, viewMonth);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--color-border)] rounded-lg bg-white hover:bg-gray-50 transition-colors"
      >
        <Calendar className="w-4 h-4 text-[var(--color-text-600)]" />
        <span className="text-[var(--color-text-900)]">{label}</span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-[var(--color-border)] rounded-xl shadow-lg p-4 w-72 select-none">
          {/* Month / Year navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              className="p-1 rounded hover:bg-gray-100 transition-colors text-[var(--color-text-600)]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-[var(--color-text-900)]">
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button
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

          {/* Week rows */}
          <div className="space-y-0.5">
            {weeks.map((week, i) => {
              const selected = isSelectedWeek(week[0]);
              const current = isCurrentWeek(week[0]);
              return (
                <div
                  key={i}
                  onClick={() => handleSelectWeek(week[0])}
                  className={`grid grid-cols-7 rounded-lg cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[var(--color-primary-600)]'
                      : current
                      ? 'bg-blue-50 hover:bg-blue-100'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {week.map((day, j) => {
                    const inMonth = day.getMonth() === viewMonth;
                    const isToday = day.toDateString() === today.toDateString();
                    return (
                      <div
                        key={j}
                        className={`text-center text-sm py-1.5 rounded ${
                          selected
                            ? 'text-white font-medium'
                            : isToday
                            ? 'font-bold text-[var(--color-primary-600)]'
                            : inMonth
                            ? 'text-[var(--color-text-900)]'
                            : 'text-gray-300'
                        }`}
                      >
                        {day.getDate()}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Today shortcut */}
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => {
                const now = new Date();
                setViewYear(now.getFullYear());
                setViewMonth(now.getMonth());
                onChange(dateToIsoWeek(now));
                setOpen(false);
              }}
              className="w-full text-xs text-center text-[var(--color-primary-600)] hover:underline"
            >
              Go to current week
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
