'use client';

import {
  ArrowDown, ArrowUp, Flame, Equal,
  Circle, CircleDot, Timer, AlertCircle, Pause, UserCheck, CheckCircle2, XCircle, Ban,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PriorityName, TicketStatusName } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

/* ---- Status ---- */
const STATUS_META: Record<TicketStatusName, { icon: LucideIcon; dot: string; bg: string; text: string }> = {
  New:             { icon: Circle,       dot: 'bg-blue-400',   bg: 'bg-blue-500/10',    text: 'text-blue-600' },
  Assigned:        { icon: UserCheck,    dot: 'bg-violet-400', bg: 'bg-violet-500/10',  text: 'text-violet-600' },
  InProgress:      { icon: Timer,        dot: 'bg-sky-400',    bg: 'bg-sky-500/10',     text: 'text-sky-600' },
  PendingCustomer: { icon: Pause,        dot: 'bg-amber-400',  bg: 'bg-amber-500/10',   text: 'text-amber-600' },
  PendingInternal: { icon: AlertCircle,  dot: 'bg-orange-400', bg: 'bg-orange-500/10',  text: 'text-orange-600' },
  Resolved:        { icon: CheckCircle2, dot: 'bg-emerald-400',bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
  Closed:          { icon: XCircle,      dot: 'bg-slate-400',  bg: 'bg-slate-500/10',   text: 'text-slate-500' },
  Cancelled:       { icon: Ban,          dot: 'bg-slate-300',  bg: 'bg-slate-400/10',   text: 'text-slate-400' },
};

export function StatusBadge({ status, className }: { status: TicketStatusName; className?: string }) {
  const t = useTranslations('ticketStatus');
  const m = STATUS_META[status] ?? STATUS_META.New;
  const Icon = m.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', m.bg, m.text, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {t(status)}
    </span>
  );
}

/* ---- Prioridade ---- */
const PRIORITY_META: Record<PriorityName, { icon: LucideIcon; dot: string; bg: string; text: string }> = {
  Low:      { icon: ArrowDown, dot: 'bg-slate-400',   bg: 'bg-slate-500/10',   text: 'text-slate-500' },
  Medium:   { icon: Equal,     dot: 'bg-blue-400',    bg: 'bg-blue-500/10',    text: 'text-blue-600' },
  High:     { icon: ArrowUp,   dot: 'bg-orange-400',  bg: 'bg-orange-500/10',  text: 'text-orange-600' },
  Critical: { icon: Flame,     dot: 'bg-red-400',     bg: 'bg-red-500/10',     text: 'text-red-600' },
};

export function PriorityBadge({ priority, className }: { priority: PriorityName; className?: string }) {
  const t = useTranslations('priority');
  const p = PRIORITY_META[priority] ?? PRIORITY_META.Medium;
  const Icon = p.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', p.bg, p.text, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {t(priority)}
    </span>
  );
}
