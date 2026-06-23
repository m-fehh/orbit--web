'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight, X, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';

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

function formatShort(iso: string, locale: string): string {
  const d = parseISO(iso);
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

function daysAgo(n: number): DateRange {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - n);
  return { from: toISO(from), to: toISO(to) };
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function countDays(from: string, to: string): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface Preset {
  key: string;
  label: string;
  range: () => DateRange;
  icon?: string;
}

function buildPresets(t: (k: string) => string): Preset[] {
  return [
    { key: 'today', label: t('today'), icon: '·', range: () => { const d = toISO(new Date()); return { from: d, to: d }; } },
    { key: 'yesterday', label: t('yesterday'), icon: '‹', range: () => { const d = new Date(); d.setDate(d.getDate() - 1); const s = toISO(d); return { from: s, to: s }; } },
    { key: '7d', label: t('last7days'), icon: '7', range: () => daysAgo(7) },
    { key: '30d', label: t('last30days'), icon: '30', range: () => daysAgo(30) },
    { key: '90d', label: t('last90days'), icon: '90', range: () => daysAgo(90) },
    { key: 'ytd', label: t('yearToDate'), icon: '∞', range: () => ({ from: `${new Date().getFullYear()}-01-01`, to: toISO(new Date()) }) },
  ];
}

// ---------------------------------------------------------------------------
// Mini Calendar
// ---------------------------------------------------------------------------

function MiniCalendar({
  year, month, hovered, onSelect, onHover, rangeFrom, rangeTo, locale,
  onPrev, onNext, showNav,
}: {
  year: number; month: number;
  hovered: string | null;
  onSelect: (iso: string) => void;
  onHover: (iso: string | null) => void;
  rangeFrom: string | null;
  rangeTo: string | null;
  locale: string;
  onPrev?: () => void;
  onNext?: () => void;
  showNav: 'left' | 'right';
}) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = toISO(new Date());

  const monthLabel = new Date(year, month).toLocaleDateString(locale, { month: 'long' });
  const yearLabel = String(year);

  const weekDays = useMemo(() => {
    const base = new Date(2024, 0, 7);
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
    return iso === (rangeFrom <= effectiveEnd ? rangeFrom : effectiveEnd);
  }

  function isEnd(iso: string) {
    if (!rangeFrom || !effectiveEnd) return false;
    return iso === (rangeFrom <= effectiveEnd ? effectiveEnd : rangeFrom);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-[260px]">
      {/* Month header */}
      <div className="mb-3 flex items-center justify-between px-1">
        {showNav === 'left' ? (
          <button type="button" onClick={onPrev} className="group flex h-7 w-7 items-center justify-center rounded-lg text-dim transition-all hover:bg-primary/10 hover:text-primary">
            <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          </button>
        ) : <span className="w-7" />}
        <div className="text-center">
          <span className="text-sm font-bold capitalize text-text">{monthLabel}</span>
          <span className="ml-1.5 text-sm font-normal text-dim">{yearLabel}</span>
        </div>
        {showNav === 'right' ? (
          <button type="button" onClick={onNext} className="group flex h-7 w-7 items-center justify-center rounded-lg text-dim transition-all hover:bg-primary/10 hover:text-primary">
            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        ) : <span className="w-7" />}
      </div>

      {/* Week day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {weekDays.map((wd, i) => (
          <span key={i} className="py-1 text-[10px] font-bold uppercase tracking-wider text-dim/60">{wd}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day == null) return <span key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const inRange = isInRange(iso);
          const start = isStart(iso);
          const end = isEnd(iso);
          const isToday = iso === today;
          const isFuture = iso > today;

          return (
            <div
              key={idx}
              className={cn(
                'relative flex items-center justify-center',
                inRange && !start && !end && 'bg-primary/[0.07]',
                start && !end && 'bg-gradient-to-r from-transparent to-primary/[0.07] [&:has(+.bg-primary\\/\\[0\\.07\\])]:to-primary/[0.07]',
                end && !start && 'bg-gradient-to-l from-transparent to-primary/[0.07]',
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(iso)}
                onMouseEnter={() => onHover(iso)}
                onMouseLeave={() => onHover(null)}
                className={cn(
                  'relative z-10 flex h-8 w-8 items-center justify-center rounded-full text-xs transition-all duration-150',
                  start || end
                    ? 'bg-primary font-bold text-primary-fg shadow-[0_2px_8px_var(--orbit-color-primary)/0.35]'
                    : inRange
                      ? 'font-medium text-primary hover:bg-primary/20'
                      : 'text-text hover:bg-bg-subtle',
                  isToday && !start && !end && 'font-bold text-primary ring-1 ring-primary/30',
                  isFuture && !start && !end && !inRange && 'text-dim/40',
                )}
              >
                {day}
              </button>
            </div>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const [selecting, setSelecting] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const now = new Date();
  const prevM = now.getMonth() - 1;
  const [leftMonth, setLeftMonth] = useState({ year: prevM < 0 ? now.getFullYear() - 1 : now.getFullYear(), month: prevM < 0 ? 11 : prevM });
  const [rightMonth, setRightMonth] = useState({ year: now.getFullYear(), month: now.getMonth() });

  const presets = useMemo(() => buildPresets(t), [t]);
  const activePreset = useMemo(() => {
    return presets.find((p) => { const r = p.range(); return r.from === value.from && r.to === value.to; });
  }, [presets, value]);

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';

  const displayText = useMemo(() => {
    if (activePreset) return activePreset.label;
    if (value.from && value.to) {
      if (value.from === value.to) return formatDisplay(value.from, locale);
      return `${formatShort(value.from, locale)}  →  ${formatShort(value.to, locale)}`;
    }
    if (value.from) return `${formatShort(value.from, locale)} → …`;
    return '';
  }, [activePreset, value, locale]);

  const dayCount = value.from && value.to ? countDays(value.from, value.to) : null;
  const hasValue = !!(value.from || value.to);

  // Position dropdown
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;
    const popW = 580;
    const popH = 380;
    const gap = 6;
    const spaceBelow = vh - rect.bottom;
    const top = spaceBelow >= popH + gap ? rect.bottom + gap : Math.max(8, rect.top - popH - gap);
    const left = Math.min(Math.max(8, rect.left), vw - popW - 8);
    setDropdownPos({ top, left });
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSelecting(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setSelecting(null); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const shiftMonths = useCallback((dir: -1 | 1) => {
    const shift = (m: { year: number; month: number }) => {
      const nm = m.month + dir;
      if (nm < 0) return { year: m.year - 1, month: 11 };
      if (nm > 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: nm };
    };
    setLeftMonth(shift);
    setRightMonth(shift);
  }, []);

  const handleDaySelect = useCallback((iso: string) => {
    if (selecting == null) {
      setSelecting(iso);
    } else {
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

  const calRange = { from: selecting ?? value.from, to: selecting ? null : value.to };

  return (
    <div className={cn('relative inline-block', className)}>
      {/* ── Trigger ── */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'group flex h-9 items-center gap-2.5 rounded-lg border px-3 text-xs transition-all duration-200 min-w-[220px]',
          'bg-panel shadow-sm',
          open
            ? 'border-primary ring-[3px] ring-primary/10'
            : hasValue
              ? 'border-primary/25 hover:border-primary/50 hover:shadow-md'
              : 'border-border hover:border-border-strong hover:shadow-md',
        )}
      >
        <div className={cn(
          'flex h-6 w-6 items-center justify-center rounded-md transition-colors duration-200',
          hasValue || open ? 'bg-primary/10 text-primary' : 'bg-bg-subtle text-dim group-hover:text-muted',
        )}>
          <CalendarDays className="h-3.5 w-3.5" />
        </div>
        <span className={cn(
          'flex-1 truncate text-left transition-colors',
          hasValue ? 'font-semibold text-text' : 'text-dim',
        )}>
          {displayText || placeholder || t('selectRange')}
        </span>
        {hasValue && dayCount && dayCount > 1 && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-primary">
            {dayCount}d
          </span>
        )}
        {hasValue ? (
          <div onClick={clear} className="flex h-5 w-5 items-center justify-center rounded-md text-dim transition-all hover:bg-danger/10 hover:text-danger">
            <X className="h-3 w-3" />
          </div>
        ) : (
          <ChevronRight className={cn('h-3 w-3 text-dim transition-transform duration-200', open && 'rotate-90')} />
        )}
      </button>

      {/* ── Dropdown ── */}
      <AnimatePresence>
        {open && (
          <Portal>
            <div ref={containerRef} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
                style={{ position: 'absolute', top: dropdownPos.top, left: dropdownPos.left }}
                className="flex overflow-hidden rounded-2xl border border-border bg-panel shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]"
              >
                {/* ── Presets sidebar ── */}
                <div className="flex w-44 shrink-0 flex-col border-r border-border bg-gradient-to-b from-bg-subtle/80 to-bg-subtle/40">
                  <div className="px-4 pb-2 pt-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-dim/70">{t('selectRange')}</p>
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 px-2 pb-3">
                    {presets.map((p) => {
                      const active = activePreset?.key === p.key;
                      return (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handlePreset(p)}
                          className={cn(
                            'group/preset flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-all duration-150',
                            active
                              ? 'bg-primary font-semibold text-primary-fg shadow-[0_2px_8px_var(--orbit-color-primary)/0.3]'
                              : 'text-muted hover:bg-panel hover:text-text hover:shadow-sm',
                          )}
                        >
                          <span className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-black tabular-nums transition-colors',
                            active ? 'bg-white/20 text-primary-fg' : 'bg-bg-subtle text-dim group-hover/preset:bg-primary/10 group-hover/preset:text-primary',
                          )}>
                            {p.icon}
                          </span>
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Range summary footer */}
                  {hasValue && (
                    <div className="border-t border-border/60 px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-dim/60">{t('customRange')}</p>
                      <p className="mt-1 text-xs font-semibold text-text">
                        {value.from && formatShort(value.from, locale)}
                        <span className="mx-1 text-dim">→</span>
                        {value.to && formatShort(value.to, locale)}
                      </p>
                      {dayCount && dayCount > 1 && (
                        <p className="mt-0.5 text-[10px] text-primary font-medium">{dayCount} {dayCount === 1 ? 'dia' : 'dias'}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Calendars ── */}
                <div className="px-5 pb-4 pt-3">
                  <div className="flex gap-6">
                    <MiniCalendar
                      year={leftMonth.year}
                      month={leftMonth.month}
                      hovered={hovered}
                      onSelect={handleDaySelect}
                      onHover={setHovered}
                      rangeFrom={calRange.from}
                      rangeTo={calRange.to}
                      locale={locale}
                      onPrev={() => shiftMonths(-1)}
                      showNav="left"
                    />
                    <div className="w-px self-stretch bg-border/50" />
                    <MiniCalendar
                      year={rightMonth.year}
                      month={rightMonth.month}
                      hovered={hovered}
                      onSelect={handleDaySelect}
                      onHover={setHovered}
                      rangeFrom={calRange.from}
                      rangeTo={calRange.to}
                      locale={locale}
                      onNext={() => shiftMonths(1)}
                      showNav="right"
                    />
                  </div>

                  {/* Selecting hint */}
                  <AnimatePresence>
                    {selecting && (
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 4 }}
                        className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-primary/[0.06] px-3 py-2"
                      >
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                        </span>
                        <span className="text-[11px] font-medium text-primary">
                          {t('selectEndDate')}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
