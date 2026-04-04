import { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';

const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/** Parse HH:MM (24-hr) into { hour12, minute, ampm } */
function parse24(value: string) {
  const [hStr, mStr] = value.split(':');
  const h24 = parseInt(hStr ?? '0', 10);
  const min = mStr ?? '00';
  const ampm = h24 < 12 ? 'AM' : 'PM';
  const hour12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return { hour12, minute: min, ampm };
}

/** Convert { hour12, minute, ampm } back to HH:MM (24-hr) */
function to24(hour12: number, minute: string, ampm: string): string {
  let h = hour12 % 12;
  if (ampm === 'PM') h += 12;
  return `${String(h).padStart(2, '0')}:${minute}`;
}

/** Display label like "09:30 AM" */
function formatLabel(value: string): string {
  if (!value) return '';
  const { hour12, minute, ampm } = parse24(value);
  return `${String(hour12).padStart(2, '0')}:${minute} ${ampm}`;
}

interface TimePickerProps {
  value: string; // 'HH:MM' 24-hour
  onChange: (time: string) => void;
  placeholder?: string;
}

export function TimePicker({ value, onChange, placeholder = 'Select time' }: TimePickerProps) {
  const parsed = value ? parse24(value) : { hour12: 12, minute: '00', ampm: 'AM' };
  const [hour12, setHour12] = useState(parsed.hour12);
  const [minute, setMinute] = useState(parsed.minute);
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(parsed.ampm as 'AM' | 'PM');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync internal state when value prop changes
  useEffect(() => {
    if (value) {
      const p = parse24(value);
      setHour12(p.hour12);
      setMinute(p.minute);
      setAmpm(p.ampm as 'AM' | 'PM');
    }
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

  const emit = (h: number, m: string, a: 'AM' | 'PM') => {
    onChange(to24(h, m, a));
  };

  const selectHour = (h: number) => { setHour12(h); emit(h, minute, ampm); };
  const selectMinute = (m: string) => { setMinute(m); emit(hour12, m, ampm); };
  const toggleAmpm = (a: 'AM' | 'PM') => { setAmpm(a); emit(hour12, minute, a); };

  const label = value ? formatLabel(value) : placeholder;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-white hover:bg-gray-50 transition-colors w-full text-left"
      >
        <Clock className="w-4 h-4 text-[var(--color-text-600)] flex-shrink-0" />
        <span className={value ? 'text-[var(--color-text-900)]' : 'text-[var(--color-text-600)]'}>
          {label}
        </span>
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-[var(--color-border)] rounded-xl shadow-lg p-4 w-72 select-none">
          {/* Header showing current selection */}
          <div className="text-center text-base font-semibold text-[var(--color-text-900)] mb-3">
            {String(hour12).padStart(2, '0')}:{minute} {ampm}
          </div>

          <div className="flex gap-2">
            {/* Hours — vertical scroll */}
            <div className="flex-1">
              <p className="text-xs text-center text-[var(--color-text-600)] mb-1.5 font-medium">Hour</p>
              <div className="flex flex-col gap-1 h-52 overflow-y-auto pr-0.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => selectHour(h)}
                    className={`py-2.5 text-base rounded-lg transition-colors text-center w-full font-medium ${
                      hour12 === h
                        ? 'bg-[var(--color-primary-600)] text-white font-medium'
                        : 'hover:bg-gray-100 text-[var(--color-text-900)]'
                    }`}
                  >
                    {String(h).padStart(2, '0')}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-[var(--color-border)] self-stretch" />

            {/* Minutes — vertical scroll */}
            <div className="flex-1">
              <p className="text-xs text-center text-[var(--color-text-600)] mb-1.5 font-medium">Min</p>
              <div className="flex flex-col gap-1 h-52 overflow-y-auto pr-0.5">
                {MINUTES.map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => selectMinute(m)}
                    className={`py-2.5 text-base rounded-lg transition-colors text-center w-full font-medium ${
                      minute === m
                        ? 'bg-[var(--color-primary-600)] text-white font-medium'
                        : 'hover:bg-gray-100 text-[var(--color-text-900)]'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px bg-[var(--color-border)] self-stretch" />

            {/* AM / PM — vertical toggle beside Min */}
            <div className="flex flex-col">
              <p className="text-xs text-center text-[var(--color-text-600)] mb-1.5 font-medium">—</p>
              <div className="flex flex-col gap-1">
                {(['AM', 'PM'] as const).map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => toggleAmpm(a)}
                    className={`px-4 py-3 text-base font-medium rounded-lg transition-colors ${
                      ampm === a
                        ? 'bg-[var(--color-primary-600)] text-white'
                        : 'bg-gray-100 text-[var(--color-text-600)] hover:bg-gray-200'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
