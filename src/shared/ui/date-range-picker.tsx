'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface DateRange {
  from: string | null;
  to: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDisplay(iso: string, locale: string): string {
  const d = parseISO(iso);
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysAgo(n: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - n);
  return { from: toISO(from), to: toISO(to) };
}

function isSameDay(a: string, b: string) { return a === b; }

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface Preset {
  key: string;
  label: string;
  range: () => DateRange;
}

function buildPresets(t: (k: string) => string): Preset[] {
  return [
    { key: 'today', label: t('today'), range: () => { const d = toISO(new Date()); return { from: d, to: d }; } },
    { key: 'yesterday', label: t('yesterday'), range: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toISO(d); return { from: s, to: s }; } },
    { key: '7d', label: t('last7days'), range: () => daysAgo(7) },
    { key: '30d', label: t('last30days'), range: () => daysAgo(30) },
    { key: '90d', label: t('last90days'), range: () => daysAgo(90) },
    { key: 'ytd', label: t('yearToDate'), range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: toISO(new Date()) }) },
  ];
}

// ---------------------------------------------------------------------------
// Mini Calendar
// ---------------------------------------------------------------------------

function MiniCalendar({
  year, month, selected, hovered, onSelect, onHover, rangeFrom, rangeTo, locale,
}: {
  year: number; month: number;
  selected: { from: string | null; to: string | null };
  hovered: string | null;
  onSelect: (iso: string) => void;
  onHover: (iso: string | null) => void;
  rangeFrom: string | null;
  rangeTo: string | null;
  locale: string;
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = toISO(new Date());

  const monthLabel = new Date(year, month).toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const weekDays = useMemo(() => {
    const base = new Date(2024, 0, 7); // Sunday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'narrow' });
    });
  }, [locale]);

  const effectiveEnd = rangeTo ?? hovered;

  function isInRange(iso: string) {
    if (!rangeFrom || !effectiveEnd) return false;
    const [a, b] = rangeFrom <= effectiveEnd ? [rangeFrom, effectiveEnd] : [effectiveEnd, rangeFrom];
    return iso >= a && iso <= b;
  }

  function isStart(iso: string) {
    if (!rangeFrom || !effectiveEnd) return false;
    const [a] = rangeFrom <= effectiveEnd ? [rangeFrom] : [effectiveEnd];
    return iso === a;
  }

  function isEnd(iso: string) {
    if (!rangeFrom || !effectiveEnd) return false;
    const [, b] = rangeFrom <= effectiveEnd ? [rangeFrom, effectiveEnd] : [effectiveEnd, rangeFrom];
    return iso === b;
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-[252px]">
      <p className="mb-2 text-center text-xs font-semibold capitalize text-text">{monthLabel}</p>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase text-dim">
        {weekDays.map((wd, i) => <span key={i} className="py-1">{wd}</span>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day == null) return <span key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const inRange = isInRange(iso);
          const start = isStart(iso);
          const end = isEnd(iso);
          const isToday = iso === today;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(iso)}
              onMouseEnter={() => onHover(iso)}
              onMouseLeave={() => onHover(null)}
              className={cn(
                'relative h-8 text-xs transition-colors',
                inRange && !start && !end && 'bg-primary/10',
                start && 'rounded-l-full bg-primary text-primary-fg',
                end && 'rounded-r-full bg-primary text-primary-fg',
                start && end && 'rounded-full',
                !inRange && !start && !end && 'hover:bg-bg-subtle',
                isToday && !start && !end && 'font-bold text-primary',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DateRangePicker
// ---------------------------------------------------------------------------

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  placeholder?: string;
}

export function DateRangePicker({ value, onChange, className, placeholder }: DateRangePickerProps) {
  const t = useTranslations('dateRange');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Selecting state: null = nothing, string = first date picked (waiting for second)
  const [selecting, setSelecting] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Calendar months
  const now = new Date();
  const [leftMonth, setLeftMonth] = useState({ year: now.getFullYear(), month: now.getMonth() - 1 < 0 ? 11 : now.getMonth() - 1 });
  const [rightMonth, setRightMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const presets = useMemo(() => buildPresets(t), [t]);
  const activePreset = useMemo(() => {
    return presets.find((p) => {
      const r = p.range();
      return r.from === value.from && r.to === value.to;
    });
  }, [presets, value]);

  // Detect locale from intl
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';

  const displayText = useMemo(() => {
    if (activePreset) return activePreset.label;
    if (value.from && value.to) {
      if (value.from === value.to) return formatDisplay(value.from, locale);
      return `${formatDisplay(value.from, locale)}  —  ${formatDisplay(value.to, locale)}`;
    }
    if (value.from) return `${formatDisplay(value.from, locale)} — ...`;
    return '';
  }, [activePreset, value, locale]);

  const hasValue = !!(value.from || value.to);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSelecting(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const prevLeftMonth = useCallback(() => {
    setLeftMonth((m) => {
      const nm = m.month - 1;
      return nm < 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: nm };
    });
    setRightMonth((m) => {
      const nm = m.month - 1;
      return nm < 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: nm };
    });
  }, []);

  const nextRightMonth = useCallback(() => {
    setLeftMonth((m) => {
      const nm = m.month + 1;
      return nm > 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: nm };
    });
    setRightMonth((m) => {
      const nm = m.month + 1;
      return nm > 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: nm };
    });
  }, []);

  const handleDaySelect = useCallback((iso: string) => {
    if (selecting == null) {
      // First click — start selection
      setSelecting(iso);
    } else {
      // Second click — complete range
      const [from, to] = selecting <= iso ? [selecting, iso] : [iso, selecting];
      onChange({ from, to });
      setSelecting(null);
      setOpen(false);
    }
  }, [selecting, onChange]);

  const handlePreset = useCallback((preset: Preset) => {
    onChange(preset.range());
    setSelecting(null);
    setOpen(false);
  }, [onChange]);

  const clear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({ from: null, to: null });
    setSelecting(null);
  }, [onChange]);

  // Effective range for calendar highlighting
  const calRange = {
    from: selecting ?? value.from,
    to: selecting ? null : value.to,
  };

  return (
    <div ref={ref} className={cn('relative inline-block', className)}>
      {/* Single input trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-8 items-center gap-2 rounded-lg border bg-panel px-3 text-xs transition-all min-w-[200px]',
          open
            ? 'border-primary shadow-[0_0_0_3px_var(--orbit-color-primary)/0.1]'
            : hasValue
              ? 'border-primary/30 hover:border-primary/50'
              : 'border-border hover:border-border-strong hover:shadow-sm',
        )}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-primary/60" />
        <span className={cn('flex-1 truncate text-left', hasValue ? 'font-medium text-text' : 'text-dim')}>
          {displayText || placeholder || t('selectRange')}
        </span>
        {hasValue && (
          <X className="h-3 w-3 shrink-0 text-dim hover:text-danger transition-colors" onClick={clear} />
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 flex overflow-hidden rounded-xl border border-border bg-panel shadow-2xl animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Presets sidebar */}
          <div className="flex w-40 shrink-0 flex-col border-r border-border bg-bg-subtle/50 py-2">
            <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-dim">{t('selectRange')}</p>
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handlePreset(p)}
                className={cn(
                  'px-3 py-1.5 text-left text-xs transition-colors',
                  activePreset?.key === p.key
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-muted hover:bg-panel hover:text-text',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Calendars */}
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={prevLeftMonth} className="rounded-md p-1 text-dim hover:bg-bg-subtle hover:text-text transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" onClick={nextRightMonth} className="rounded-md p-1 text-dim hover:bg-bg-subtle hover:text-text transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-4">
              <MiniCalendar
                year={leftMonth.year}
                month={leftMonth.month}
                selected={value}
                hovered={hovered}
                onSelect={handleDaySelect}
                onHover={setHovered}
                rangeFrom={calRange.from}
                rangeTo={calRange.to}
                locale={locale}
              />
              <MiniCalendar
                year={rightMonth.year}
                month={rightMonth.month}
                selected={value}
                hovered={hovered}
                onSelect={handleDaySelect}
                onHover={setHovered}
                rangeFrom={calRange.from}
                rangeTo={calRange.to}
                locale={locale}
              />
            </div>
            {selecting && (
              <p className="mt-2 text-center text-[10px] text-primary animate-pulse">
                {t('selectEndDate')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
