'use client';

import { ArrowDown, Minus, ArrowUp, Flame, type LucideIcon } from 'lucide-react';
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

const STATUS_LABEL: Record<TicketStatusName, string> = {
  New: 'Novo',
  Assigned: 'Atribuído',
  InProgress: 'Em andamento',
  PendingCustomer: 'Aguardando cliente',
  PendingInternal: 'Aguardando interno',
  Resolved: 'Resolvido',
  Closed: 'Fechado',
  Cancelled: 'Cancelado',
};

export function StatusBadge({ status, className }: { status: TicketStatusName; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        STATUS_STYLE[status],
        className,
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

/* ---- Prioridade: ícone + texto colorido (visual distinto do status) ---- */
const PRIORITY: Record<PriorityName, { label: string; icon: LucideIcon; color: string }> = {
  Low: { label: 'Baixa', icon: ArrowDown, color: 'text-muted' },
  Medium: { label: 'Média', icon: Minus, color: 'text-info' },
  High: { label: 'Alta', icon: ArrowUp, color: 'text-orange-400' },
  Critical: { label: 'Crítica', icon: Flame, color: 'text-danger' },
};

export function PriorityBadge({ priority, className }: { priority: PriorityName; className?: string }) {
  const p = PRIORITY[priority] ?? PRIORITY.Medium;
  const Icon = p.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', p.color, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {p.label}
    </span>
  );
}

export { STATUS_LABEL };
