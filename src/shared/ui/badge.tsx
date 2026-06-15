'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type Size = 'xs' | 'sm';

const TONES: Record<Tone, string> = {
  neutral: 'bg-panel-2 text-muted',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  info: 'bg-info/15 text-info',
};

const SIZES: Record<Size, string> = {
  xs: 'h-5 px-1.5 text-[10px] gap-1',
  sm: 'h-6 px-2 text-xs gap-1.5',
};

/** Badge genérica do design system. Usar para status, prioridade, severidade, tipos. */
export function Badge({
  tone = 'neutral',
  size = 'sm',
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  size?: Size;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium leading-none',
        TONES[tone],
        SIZES[size],
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}
