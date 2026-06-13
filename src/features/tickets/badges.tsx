'use client';

import type { PriorityName, TicketStatusName } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

const PRIORITY_STYLE: Record<PriorityName, string> = {
  Low: 'border-info/40 text-info bg-info/10',
  Medium: 'border-warning/40 text-warning bg-warning/10',
  High: 'border-orange-500/40 text-orange-400 bg-orange-500/10',
  Critical: 'border-danger/50 text-danger bg-danger/10',
};

const PRIORITY_LABEL: Record<PriorityName, string> = {
  Low: 'Baixa',
  Medium: 'Média',
  High: 'Alta',
  Critical: 'Crítica',
};

const STATUS_STYLE: Record<TicketStatusName, string> = {
  New: 'border-info/40 text-info bg-info/10',
  Assigned: 'border-primary/40 text-primary bg-primary-soft',
  InProgress: 'border-info/40 text-info bg-info/10',
  PendingCustomer: 'border-warning/40 text-warning bg-warning/10',
  PendingInternal: 'border-warning/40 text-warning bg-warning/10',
  Resolved: 'border-success/40 text-success bg-success/10',
  Closed: 'border-border-strong text-muted bg-panel-2',
  Cancelled: 'border-border-strong text-dim bg-panel-2',
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

const base = 'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold';

export function PriorityBadge({ priority }: { priority: PriorityName }) {
  return (
    <span className={cn(base, PRIORITY_STYLE[priority])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {PRIORITY_LABEL[priority] ?? priority}
    </span>
  );
}

export function StatusBadge({ status }: { status: TicketStatusName }) {
  return <span className={cn(base, STATUS_STYLE[status])}>{STATUS_LABEL[status] ?? status}</span>;
}

export { STATUS_LABEL, PRIORITY_LABEL };
