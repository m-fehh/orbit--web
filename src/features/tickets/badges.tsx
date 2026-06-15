'use client';

import { ArrowDown, Minus, ArrowUp, Flame, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PriorityName, TicketStatusName } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

/* ---- Status: lozenge (estilo Jira/Azure), cor própria por estado ---- */
const STATUS_STYLE: Record<TicketStatusName, string> = {
  New: 'bg-info/15 text-info',
  Assigned: 'bg-primary-soft text-primary',
  InProgress: 'bg-info/15 text-info',
  PendingCustomer: 'bg-warning/15 text-warning',
  PendingInternal: 'bg-warning/15 text-warning',
  Resolved: 'bg-success/15 text-success',
  Closed: 'bg-panel-2 text-muted',
  Cancelled: 'bg-panel-2 text-dim',
};

export function StatusBadge({ status, className }: { status: TicketStatusName; className?: string }) {
  const t = useTranslations('ticketStatus');
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STATUS_STYLE[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}

/* ---- Prioridade: ícone + texto colorido (visual distinto do status) ---- */
const PRIORITY_ICON: Record<PriorityName, { icon: LucideIcon; color: string }> = {
  Low: { icon: ArrowDown, color: 'text-muted' },
  Medium: { icon: Minus, color: 'text-info' },
  High: { icon: ArrowUp, color: 'text-orange-400' },
  Critical: { icon: Flame, color: 'text-danger' },
};

export function PriorityBadge({ priority, className }: { priority: PriorityName; className?: string }) {
  const t = useTranslations('priority');
  const p = PRIORITY_ICON[priority] ?? PRIORITY_ICON.Medium;
  const Icon = p.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', p.color, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {t(priority)}
    </span>
  );
}
