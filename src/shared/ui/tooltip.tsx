'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

/**
 * Tooltip leve baseado em CSS — sem dependência de Floating UI. Posicionamento
 * com `position: absolute` relativo ao wrapper; suficiente para o uso geral
 * do app (ícones, badges, ações). Para casos com overflow extremo, usar Portal.
 */
export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 200,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}) {
  const [open, setOpen] = useState(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => { timer = setTimeout(() => setOpen(true), delay); }}
      onMouseLeave={() => { if (timer) clearTimeout(timer); setOpen(false); }}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            'pointer-events-none absolute z-50 whitespace-nowrap rounded bg-bg-strong px-2 py-1 text-xs text-text shadow-lg',
            side === 'top' && '-top-1 left-1/2 -translate-x-1/2 -translate-y-full',
            side === 'bottom' && '-bottom-1 left-1/2 -translate-x-1/2 translate-y-full',
            side === 'left' && 'right-full top-1/2 -translate-y-1/2 -translate-x-1',
            side === 'right' && 'left-full top-1/2 -translate-y-1/2 translate-x-1',
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
