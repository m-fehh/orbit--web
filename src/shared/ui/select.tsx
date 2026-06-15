'use client';

import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface SelectOption<T extends string | number = number> {
  value: T;
  label: string;
}

/**
 * Select customizado (substitui o `<select>` nativo). Dropdown estilizado,
 * com a seta espaçada da borda e itens com hover/seleção consistentes.
 */
export function Select<T extends string | number = number>({
  options,
  value,
  onChange,
  placeholder = 'Selecionar…',
  className,
  disabled,
}: {
  options: SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? null;

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex h-10 w-full items-center gap-sm rounded-md border border-border bg-bg-subtle pl-md pr-2.5 text-sm outline-none transition-all',
          'hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50',
        )}
      >
        <span className={cn('flex-1 truncate text-left', !selected && 'text-dim')}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-dim transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-40 mt-1 max-h-60 overflow-y-auto rounded-md border border-border bg-panel py-1 shadow-lg"
          >
            {options.map((o) => (
              <li key={String(o.value)}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
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
        </>
      )}
    </div>
  );
}
