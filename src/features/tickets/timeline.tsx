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
import { LoadingState } from '@/shared/ui/states';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { cn } from '@/shared/lib/utils';

// ─── Tipos ──────────────────────────────────────────────
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

// ─── Metadados usando variáveis do tema ────────────────
const KIND_META: Record<TimelineKind, { icon: typeof Activity; tone: string; bg: string; ring: string }> = {
  created:       { icon: FilePlus,      tone: 'text-primary',           bg: 'bg-primary/10',           ring: 'ring-primary/10' },
  status:        { icon: ArrowRight,    tone: 'text-info',              bg: 'bg-info/10',              ring: 'ring-info/10' },
  priority:      { icon: Tag,           tone: 'text-warning',           bg: 'bg-warning/10',           ring: 'ring-warning/10' },
  assignee:      { icon: UserPlus,      tone: 'text-primary',           bg: 'bg-primary/10',           ring: 'ring-primary/10' },
  team:          { icon: Users,         tone: 'text-primary',           bg: 'bg-primary/10',           ring: 'ring-primary/10' },
  comment:       { icon: MessageSquare, tone: 'text-text',              bg: 'bg-panel',                ring: 'ring-border' },
  attachment:    { icon: Paperclip,     tone: 'text-muted',             bg: 'bg-muted/10',             ring: 'ring-muted/10' },
  worklog:       { icon: Timer,         tone: 'text-success',           bg: 'bg-success/10',           ring: 'ring-success/10' },
  investigation: { icon: Sparkles,      tone: 'text-info',              bg: 'bg-info/10',              ring: 'ring-info/10' },
  resolution:    { icon: Wrench,        tone: 'text-success',           bg: 'bg-success/10',           ring: 'ring-success/10' },
  reopened:      { icon: AlertCircle,   tone: 'text-warning',           bg: 'bg-warning/10',           ring: 'ring-warning/10' },
  sla:           { icon: ShieldAlert,   tone: 'text-danger',            bg: 'bg-danger/10',            ring: 'ring-danger/10' },
  audit:         { icon: Activity,      tone: 'text-muted',             bg: 'bg-muted/10',             ring: 'ring-muted/10' },
};

// ─── Mapeamento de campos de auditoria para keys i18n ──
const AUDIT_FIELD_KEY: Record<string, string> = {
  Status: 'ticket.statusUpdated',
  Priority: 'priority',
  AssignedUserId: 'ticket.assignee',
  AssignedTeamId: 'ticket.team',
  EstimateMinutes: 'timeline.estimateMinutes',
  SlaBreachNotifiedAt: 'timeline.slaBreach',
};

// ─── Helpers de conversão ──────────────────────────────
function fromAudit(
  a: AuditLogResponse,
  t: ReturnType<typeof useTranslations>,
  formatFieldValue: (fieldName: string, value: string | null) => string,
): TimelineEvent | null {
  if (a.action === 'Insert') return null;

  if (a.action !== 'Update') {
    return {
      id: `audit-${a.id}`,
      kind: 'audit',
      at: a.occurredAt,
      actor: a.userName,
      title: t('timeline.updated'),
      detail: a.entityName,
    };
  }

  const knownField = a.fields.find((f) =>
    Object.keys(AUDIT_FIELD_KEY).includes(f.fieldName),
  );

  if (!knownField) {
    return {
      id: `audit-${a.id}`,
      kind: 'audit',
      at: a.occurredAt,
      actor: a.userName,
      title: t('timeline.updated'),
      detail: a.fields
        .map((f) => `${f.fieldName}: ${formatFieldValue(f.fieldName, f.oldValue)} → ${formatFieldValue(f.fieldName, f.newValue)}`)
        .join(' · '),
    };
  }

  const kind: TimelineKind =
    knownField.fieldName === 'Status' ? 'status' :
    knownField.fieldName === 'Priority' ? 'priority' :
    knownField.fieldName === 'AssignedUserId' ? 'assignee' :
    knownField.fieldName === 'AssignedTeamId' ? 'team' :
    knownField.fieldName === 'EstimateMinutes' ? 'worklog' :
    knownField.fieldName === 'SlaBreachNotifiedAt' ? 'sla' :
    'audit';

  const fieldLabel = t(AUDIT_FIELD_KEY[knownField.fieldName]);
  const oldVal = formatFieldValue(knownField.fieldName, knownField.oldValue);
  const newVal = formatFieldValue(knownField.fieldName, knownField.newValue);

  return {
    id: `audit-${a.id}`,
    kind,
    at: a.occurredAt,
    actor: a.userName,
    title: `${fieldLabel}: ${oldVal} → ${newVal}`,
  };
}

function fromComment(
  c: TicketCommentResponse,
  userName: (uid: number | null) => string,
  t: ReturnType<typeof useTranslations>,
): TimelineEvent {
  return {
    id: `comment-${c.id}`,
    kind: 'comment',
    at: c.createdAt ?? new Date(0).toISOString(),
    actor: userName(c.userId),
    title: c.isInternal ? t('comments.internal') : t('comments.public'),
    detail: c.message,
    internal: c.isInternal,
  };
}

function fromWorklog(
  w: WorklogResponse,
  userName: (uid: number | null) => string,
  t: ReturnType<typeof useTranslations>,
): TimelineEvent {
  const h = Math.floor(w.durationMinutes / 60);
  const m = w.durationMinutes % 60;
  const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  return {
    id: `worklog-${w.id}`,
    kind: 'worklog',
    at: w.startedAt ?? w.createdAt ?? new Date(0).toISOString(),
    actor: userName(w.userId),
    title: `${dur} — ${t(`worklogType.${w.type}`)}`,
    detail: w.description,
  };
}

// ─── Componente principal ──────────────────────────────
export function TicketTimeline({
  ticket,
  userName,
}: {
  ticket: TicketDetailResponse;
  userName: (uid: number | null) => string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';

  const audit = useQuery({
    queryKey: ['audit', 'Ticket', ticket.id],
    queryFn: () => auditApi.forEntity('Ticket', ticket.id, 200),
    retry: false,
  });

  const attachments = useQuery({
    queryKey: ['tickets', 'attachments', ticket.id],
    queryFn: () => ticketsApi.listAttachments(ticket.id),
    retry: false,
  });

  // ─── Formata valores de campos de auditoria ──────────
  const formatFieldValue = (fieldName: string, value: string | null): string => {
    if (value == null || value === '') return '—';

    if (fieldName === 'Status') {
      return t(`ticketStatus.${value}`);
    }

    if (fieldName === 'Priority') {
      return t(`priority.${value}`);
    }

    if (fieldName === 'SlaBreachNotifiedAt' || fieldName.endsWith('At')) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat(locale, {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone,
          }).format(date);
        }
      } catch { /* fallback */ }
    }

    if (fieldName === 'EstimateMinutes' && !isNaN(Number(value))) {
      const mins = Number(value);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
    }

    return value;
  };

  // ─── Monta a lista de eventos (deduplicada) ─────────
  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    list.push({
      id: `created-${ticket.id}`,
      kind: 'created',
      at: ticket.openedAt,
      actor: userName(ticket.customerId),
      title: t('timeline.created'),
      detail: ticket.title,
    });

    ticket.comments.forEach((c) => list.push(fromComment(c, userName, t)));
    ticket.worklogs.forEach((w) => list.push(fromWorklog(w, userName, t)));

    ticket.investigations.forEach((inv) => {
      if (inv.startedAt) {
        list.push({
          id: `inv-start-${inv.id}`,
          kind: 'investigation',
          at: inv.startedAt,
          actor: null,
          title: t('timeline.investigationStarted'),
          detail: inv.summary ?? undefined,
        });
      }
      if (inv.finishedAt) {
        list.push({
          id: `inv-end-${inv.id}`,
          kind: 'investigation',
          at: inv.finishedAt,
          actor: null,
          title: t('timeline.investigationFinished'),
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
          title: t('timeline.attachmentAdded'),
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
        title: t('timeline.closed'),
      });
    }

    const seenIds = new Set<string>();
    (audit.data?.items ?? []).forEach((a) => {
      const ev = fromAudit(a, t, formatFieldValue);
      if (ev && !seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        list.push(ev);
      }
    });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [ticket, audit.data, attachments.data, userName, t, locale, timeZone]);

  // ─── Loading / Vazio ────────────────────────────────
  if (audit.isLoading) return <LoadingState label={t('timeline.loading')} />;
  if (events.length === 0) {
    return (
      <div className="py-20 text-center">
        <p className="text-base text-muted">{t('timeline.empty')}</p>
      </div>
    );
  }

  // ─── Agrupamento por dia ─────────────────────────────
  const dayFmt = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone,
  });
  const timeFmt = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  });
  const todayKey = dayFmt.format(new Date());
  const yesterdayKey = dayFmt.format(new Date(Date.now() - 86_400_000));
  const dayLabel = (key: string) =>
    key === todayKey ? t('timeline.today') : key === yesterdayKey ? t('timeline.yesterday') : key;

  const groups: { day: string; events: TimelineEvent[] }[] = [];
  for (const ev of events) {
    const day = dayFmt.format(new Date(ev.at));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.events.push(ev);
    } else {
      groups.push({ day, events: [ev] });
    }
  }

  const actorInitials = (name: string | null) =>
    (name ?? '?')
      .split(' ')
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('');

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="w-full py-4">
      {groups.map((g, groupIdx) => {
        const isLastGroup = groupIdx === groups.length - 1;
        // Só mostra linha se tiver mais de 1 evento no grupo
        const showLine = g.events.length > 1;

        return (
          <section key={g.day} className="mb-12 last:mb-0">
            {/* Cabeçalho do dia */}
            <div className="sticky top-0 z-10 -mx-2 mb-6 bg-bg/80 px-2 py-3 backdrop-blur-sm">
              <h3 className="text-sm font-semibold uppercase tracking-widest text-muted">
                {dayLabel(g.day)}
              </h3>
            </div>

            {/* Lista: border-l só aparece se showLine for true */}
            <ol
              className={cn(
                'relative ml-5',
                showLine && 'border-l-2 border-border',
              )}
            >
              {g.events.map((ev, idx) => {
                const meta = KIND_META[ev.kind];
                const Icon = meta.icon;
                const isComment = ev.kind === 'comment';

                // Último evento do último grupo: sem padding bottom
                const isLastEvent = isLastGroup && idx === g.events.length - 1;

                return (
                  <li
                    key={ev.id}
                    className={cn(
                      'relative pb-10 pl-10',
                      isLastEvent && 'pb-0',
                    )}
                  >
                    {/* Círculo com background sólido para cobrir a linha */}
                    <span
                      className={cn(
                        'absolute -left-[17px] top-0.5 z-[1] flex h-8 w-8 items-center justify-center rounded-full border-2 border-bg shadow-sm',
                        meta.bg,
                        meta.ring,
                        'ring-[5px]',
                        // Background sólido do tema pra cobrir a linha
                        'bg-bg',
                      )}
                      title={ev.actor ?? t('timeline.system')}
                    >
                      {isComment ? (
                        <span className="text-[11px] font-bold text-text">
                          {actorInitials(ev.actor)}
                        </span>
                      ) : (
                        <Icon className={cn('h-4 w-4', meta.tone)} aria-hidden />
                      )}
                    </span>

                    {/* Conteúdo */}
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-1.5 text-sm min-w-0">
                        <span className="font-semibold text-text truncate">
                          {ev.actor ?? t('timeline.system')}
                        </span>
                        <span className="text-muted/70">·</span>
                        {!isComment && (
                          <>
                            <span className="text-text/80 truncate">{ev.title}</span>
                            <span className="text-muted/70">·</span>
                          </>
                        )}
                        <span className="text-xs text-muted shrink-0 tabular-nums">
                          {timeFmt.format(new Date(ev.at))}
                        </span>
                      </div>

                      {isComment ? (
                        <div
                          className={cn(
                            'mt-2 rounded-xl border px-5 py-4 text-sm leading-relaxed',
                            ev.internal
                              ? 'border-warning/25 bg-warning/[0.04]'
                              : 'border-border bg-panel',
                          )}
                        >
                          {ev.internal && (
                            <span className="mb-2.5 inline-block rounded-lg bg-warning/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-warning">
                              {ev.title}
                            </span>
                          )}
                          <p className="whitespace-pre-wrap text-text break-words">{ev.detail}</p>
                        </div>
                      ) : (
                        ev.detail && (
                          <p className="text-sm text-muted truncate">{ev.detail}</p>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}