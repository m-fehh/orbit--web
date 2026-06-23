'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function MiniCalendar({
  year, month, selected, locale, onSelect, onPrev, onNext,
}: {
  year: number; month: number; selected: string | null; locale: string;
  onSelect: (iso: string) => void; onPrev: () => void; onNext: () => void;
}) {
  const today = toISO(new Date());
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const monthLabel = new Date(year, month).toLocaleDateString(locale, { month: 'long' });

  const weekDays = useMemo(() => {
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString(locale, { weekday: 'narrow' });
    });
  }, [locale]);

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="w-[260px]">
      <div className="mb-3 flex items-center justify-between px-1">
        <button type="button" onClick={onPrev} className="group flex h-7 w-7 items-center justify-center rounded-lg text-dim transition-all hover:bg-primary/10 hover:text-primary">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <span className="text-sm font-bold capitalize text-text">{monthLabel}</span>
          <span className="ml-1.5 text-sm font-normal text-dim">{year}</span>
        </div>
        <button type="button" onClick={onNext} className="group flex h-7 w-7 items-center justify-center rounded-lg text-dim transition-all hover:bg-primary/10 hover:text-primary">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 text-center">
        {weekDays.map((wd, i) => (
          <span key={i} className="py-1 text-[10px] font-bold uppercase tracking-wider text-dim/60">{wd}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day == null) return <span key={idx} />;
          const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isSelected = iso === selected;
          const isToday = iso === today;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-full text-xs transition-all duration-150 mx-auto',
                isSelected
                  ? 'bg-primary font-bold text-primary-fg shadow-[0_2px_8px_var(--orbit-color-primary)/0.35]'
                  : 'text-text hover:bg-bg-subtle',
                isToday && !isSelected && 'font-bold text-primary ring-1 ring-primary/30',
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

const CALENDAR_W = 292;
const CALENDAR_H = 340;
const GAP = 6;

function calcPosition(rect: DOMRect): { top: number; left: number } {
  const vh = window.innerHeight;
  const vw = window.innerWidth;

  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;
  const spaceRight = vw - rect.right;
  const spaceLeft = rect.left;

  // Try right side first (lateral)
  if (spaceRight >= CALENDAR_W + GAP) {
    const top = Math.min(rect.top, vh - CALENDAR_H - 8);
    return { top: Math.max(8, top), left: rect.right + GAP };
  }
  // Try left side
  if (spaceLeft >= CALENDAR_W + GAP) {
    const top = Math.min(rect.top, vh - CALENDAR_H - 8);
    return { top: Math.max(8, top), left: rect.left - CALENDAR_W - GAP };
  }
  // Try below
  if (spaceBelow >= CALENDAR_H + GAP) {
    const left = Math.min(rect.left, vw - CALENDAR_W - 8);
    return { top: rect.bottom + GAP, left: Math.max(8, left) };
  }
  // Fallback: above
  const left = Math.min(rect.left, vw - CALENDAR_W - 8);
  return { top: Math.max(8, rect.top - CALENDAR_H - GAP), left: Math.max(8, left) };
}

export interface DatePickerProps {
  value: string | null;
  onChange: (iso: string | null) => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
}

export function DatePicker({ value, onChange, className, placeholder, required }: DatePickerProps) {
  const t = useTranslations('dateRange');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });

  const initial = value ? parseISO(value) : new Date();
  const [viewMonth, setViewMonth] = useState({ year: initial.getFullYear(), month: initial.getMonth() });

  const locale = typeof navigator !== 'undefined' ? navigator.language : 'pt-BR';

  const displayText = useMemo(() => {
    if (!value) return '';
    return parseISO(value).toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  }, [value, locale]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    setDropdownPos(calcPosition(triggerRef.current.getBoundingClientRect()));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const shift = useCallback((dir: -1 | 1) => {
    setViewMonth((m) => {
      const nm = m.month + dir;
      if (nm < 0) return { year: m.year - 1, month: 11 };
      if (nm > 11) return { year: m.year + 1, month: 0 };
      return { year: m.year, month: nm };
    });
  }, []);

  const handleSelect = useCallback((iso: string) => {
    onChange(iso);
    setOpen(false);
  }, [onChange]);

  const clear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  }, [onChange]);

  return (
    <div className={cn('relative inline-block', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'group flex h-10 w-full items-center gap-2.5 rounded-lg border px-3 text-sm transition-all duration-200',
          'bg-bg-subtle shadow-sm',
          open
            ? 'border-primary ring-[3px] ring-primary/10'
            : value
              ? 'border-primary/25 hover:border-primary/50'
              : 'border-border hover:border-border-strong',
        )}
      >
        <Calendar className={cn('h-4 w-4 shrink-0 transition-colors', value || open ? 'text-primary' : 'text-dim')} />
        <span className={cn('flex-1 truncate text-left', value ? 'text-text' : 'text-dim')}>
          {displayText || placeholder || t('selectRange')}
        </span>
        {value && !required && (
          <div onClick={clear} className="flex h-5 w-5 items-center justify-center rounded-md text-dim transition-all hover:bg-danger/10 hover:text-danger">
            <X className="h-3 w-3" />
          </div>
        )}
      </button>

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
                className="overflow-hidden rounded-2xl border border-border bg-panel p-4 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]"
              >
                <MiniCalendar
                  year={viewMonth.year}
                  month={viewMonth.month}
                  selected={value}
                  locale={locale}
                  onSelect={handleSelect}
                  onPrev={() => shift(-1)}
                  onNext={() => shift(1)}
                />
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}
