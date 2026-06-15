'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, AlertCircle, ArrowRight, FilePlus, MessageSquare, Paperclip,
  ShieldAlert, Sparkles, Tag, Timer, UserPlus, Users, Wrench,
} from 'lucide-react';
import type { Locale } from '@/shared/i18n/config';
import { auditApi, ticketsApi } from '@/shared/api/endpoints';
import type { AuditLogResponse, TicketCommentResponse, TicketDetailResponse, WorklogResponse } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState } from '@/shared/ui/states';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { cn } from '@/shared/lib/utils';

type TimelineKind =
  | 'created' | 'status' | 'priority' | 'assignee' | 'team'
  | 'comment' | 'attachment' | 'worklog' | 'investigation'
  | 'resolution' | 'reopened' | 'sla' | 'audit';

interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  actor: string | null;
  title: string;
  detail?: string;
  internal?: boolean;
}

const KIND_META: Record<TimelineKind, { icon: typeof Activity; tone: string }> = {
  created: { icon: FilePlus, tone: 'text-primary' },
  status: { icon: ArrowRight, tone: 'text-info' },
  priority: { icon: Tag, tone: 'text-warning' },
  assignee: { icon: UserPlus, tone: 'text-primary' },
  team: { icon: Users, tone: 'text-primary' },
  comment: { icon: MessageSquare, tone: 'text-text' },
  attachment: { icon: Paperclip, tone: 'text-muted' },
  worklog: { icon: Timer, tone: 'text-success' },
  investigation: { icon: Sparkles, tone: 'text-info' },
  resolution: { icon: Wrench, tone: 'text-success' },
  reopened: { icon: AlertCircle, tone: 'text-warning' },
  sla: { icon: ShieldAlert, tone: 'text-danger' },
  audit: { icon: Activity, tone: 'text-muted' },
};

/** Mapeia uma linha de AuditLog para um evento da timeline. */
function fromAudit(a: AuditLogResponse): TimelineEvent | null {
  // Cada log normalmente tem 1+ field changes — geramos um evento "rico" por log,
  // priorizando campos conhecidos (Status, Priority, AssignedUserId, AssignedTeamId).
  if (a.action !== 'Update') {
    return a.action === 'Insert'
      ? null // a criação tem evento próprio
      : {
        id: `audit-${a.id}`,
        kind: 'audit',
        at: a.occurredAt,
        actor: a.userName,
        title: a.action,
        detail: a.entityName,
      };
  }
  const known = a.fields.find((f) => ['Status', 'Priority', 'AssignedUserId', 'AssignedTeamId'].includes(f.fieldName));
  if (!known) {
    return {
      id: `audit-${a.id}`,
      kind: 'audit',
      at: a.occurredAt,
      actor: a.userName,
      title: a.fields.map((f) => f.fieldName).join(', ') || 'Atualização',
      detail: a.fields
        .map((f) => `${f.fieldName}: ${f.oldValue ?? '∅'} → ${f.newValue ?? '∅'}`)
        .join(' · '),
    };
  }
  const kind: TimelineKind =
    known.fieldName === 'Status' ? 'status' :
    known.fieldName === 'Priority' ? 'priority' :
    known.fieldName === 'AssignedUserId' ? 'assignee' : 'team';
  return {
    id: `audit-${a.id}`,
    kind,
    at: a.occurredAt,
    actor: a.userName,
    title: `${known.fieldName}: ${known.oldValue ?? '—'} → ${known.newValue ?? '—'}`,
  };
}

function fromComment(c: TicketCommentResponse, userName: (uid: number | null) => string): TimelineEvent {
  return {
    id: `comment-${c.id}`,
    kind: 'comment',
    at: c.createdAt ?? new Date(0).toISOString(),
    actor: userName(c.userId),
    title: c.isInternal ? 'Comentário interno' : 'Comentário',
    detail: c.message,
    internal: c.isInternal,
  };
}

function fromWorklog(w: WorklogResponse, userName: (uid: number | null) => string): TimelineEvent {
  const h = Math.floor(w.durationMinutes / 60);
  const m = w.durationMinutes % 60;
  const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  return {
    id: `worklog-${w.id}`,
    kind: 'worklog',
    at: w.startedAt ?? w.createdAt ?? new Date(0).toISOString(),
    actor: userName(w.userId),
    title: `Tempo registrado · ${dur} (${w.type})`,
    detail: w.description,
  };
}

export function TicketTimeline({
  ticket,
  userName,
}: {
  ticket: TicketDetailResponse;
  userName: (uid: number | null) => string;
}) {
  const t = useTranslations('timeline');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';

  const audit = useQuery({
    queryKey: ['audit', 'Ticket', ticket.id],
    queryFn: () => auditApi.forEntity('Ticket', ticket.id, 200),
    // Auditoria pode não estar exposta a todos os perfis; falha em silêncio
    // (sem quebrar a timeline) para não bloquear o restante do histórico.
    retry: false,
  });

  const attachments = useQuery({
    queryKey: ['tickets', 'attachments', ticket.id],
    queryFn: () => ticketsApi.listAttachments(ticket.id),
    retry: false,
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    list.push({
      id: `created-${ticket.id}`,
      kind: 'created',
      at: ticket.openedAt,
      actor: userName(ticket.customerId),
      title: t('created'),
      detail: ticket.title,
    });

    ticket.comments.forEach((c) => list.push(fromComment(c, userName)));
    ticket.worklogs.forEach((w) => list.push(fromWorklog(w, userName)));

    ticket.investigations.forEach((inv) => {
      if (inv.startedAt) {
        list.push({
          id: `inv-start-${inv.id}`,
          kind: 'investigation',
          at: inv.startedAt,
          actor: null,
          title: t('investigationStarted'),
          detail: inv.summary ?? undefined,
        });
      }
      if (inv.finishedAt) {
        list.push({
          id: `inv-end-${inv.id}`,
          kind: 'investigation',
          at: inv.finishedAt,
          actor: null,
          title: t('investigationFinished'),
        });
      }
    });

    (attachments.data ?? []).forEach((a) => {
      if (a.createdAt) {
        list.push({
          id: `att-${a.id}`,
          kind: 'attachment',
          at: a.createdAt,
          actor: userName(a.uploadedById),
          title: t('attachmentAdded'),
          detail: a.fileName,
        });
      }
    });

    if (ticket.closedAt) {
      list.push({
        id: `closed-${ticket.id}`,
        kind: 'resolution',
        at: ticket.closedAt,
        actor: null,
        title: t('closed'),
      });
    }

    (audit.data?.items ?? []).forEach((a) => {
      const ev = fromAudit(a);
      if (ev) list.push(ev);
    });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [ticket, audit.data, attachments.data, userName, t]);

  if (audit.isLoading) return <LoadingState label={t('loading')} />;

  return (
    <div className="relative">
      <div className="absolute left-[15px] top-0 h-full w-px bg-border" aria-hidden />
      <ol className="flex flex-col gap-md">
        {events.map((ev) => {
          const meta = KIND_META[ev.kind];
          const Icon = meta.icon;
          return (
            <li key={ev.id} className="relative pl-10">
              <span
                className={cn(
                  'absolute left-0 top-0 grid h-[30px] w-[30px] place-items-center rounded-full border border-border bg-panel',
                  meta.tone,
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <div
                className={cn(
                  'card-surface p-md',
                  ev.internal && 'border-warning/40 bg-warning/5',
                )}
              >
                <div className="flex flex-wrap items-baseline gap-x-sm gap-y-0.5 text-xs text-muted">
                  <span className="font-semibold text-text">{ev.actor ?? t('system')}</span>
                  <span>·</span>
                  <span>{ev.title}</span>
                  <span className="ml-auto text-dim">{formatDateTime(ev.at, { locale, timeZone })}</span>
                </div>
                {ev.detail && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-text">{ev.detail}</p>
                )}
              </div>
            </li>
          );
        })}
        {events.length === 0 && <li className="pl-10 text-sm text-dim">{t('empty')}</li>}
      </ol>
    </div>
  );
}
