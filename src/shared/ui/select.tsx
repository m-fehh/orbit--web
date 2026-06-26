'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface SelectOption<T extends string | number = number> {
  value: T;
  label: string;
}

export function Select<T extends string | number = number>({
  options,
  value,
  onChange,
  placeholder = 'Selecionar…',
  className,
  disabled,
  loading,
}: {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Mostra um spinner e bloqueia o controle enquanto a alteração é persistida (auto-save). */
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  const openMenu = () => {
    if (loading) return;
    if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    setOpen(true);
  };

  // Recalculate position on scroll/resize
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (btnRef.current) setRect(btnRef.current.getBoundingClientRect());
    };
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
  }, [open]);

  const dropdownStyle = rect
    ? {
        position: 'fixed' as const,
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      }
    : {};

  return (
    <div className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || loading}
        onClick={openMenu}
        className={cn(
          'flex h-10 w-full items-center gap-sm rounded-md border border-border bg-bg-subtle pl-md pr-2.5 text-sm outline-none transition-all',
          'hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50',
        )}
      >
        <span className={cn('flex-1 truncate text-left', !selected && 'text-dim')}>
          {selected ? selected.label : placeholder}
        </span>
        {loading
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
          : <ChevronDown className={cn('h-4 w-4 shrink-0 text-dim transition-transform', open && 'rotate-180')} aria-hidden />}
      </button>

      {open && typeof window !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            style={dropdownStyle}
            className="max-h-60 overflow-y-auto rounded-md border border-border bg-panel py-1 shadow-xl"
          >
            {options.map((o) => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center gap-sm px-md py-2 text-left text-sm hover:bg-panel-2',
                    o.value === value && 'text-primary',
                  )}
                >
                  <span className="flex-1">{o.label}</span>
                  {o.value === value && <Check className="h-4 w-4" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </>,
        document.body,
      )}
    </div>
  );
}
