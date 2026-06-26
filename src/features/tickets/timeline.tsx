'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, AlertCircle, ArrowRight, ChevronDown, ChevronRight, FilePlus,
  MessageSquare, Paperclip, ShieldAlert, Sparkles, Tag, Timer, UserPlus, Users, Wrench,
} from 'lucide-react';
import type { Locale } from '@/shared/i18n/config';
import { auditApi, ticketsApi, iterationsApi } from '@/shared/api/endpoints';
import type { AuditLogResponse, TicketCommentResponse, TicketDetailResponse, WorklogResponse } from '@/shared/api/types';
import { LoadingState } from '@/shared/ui/states';
import { MarkdownContent } from '@/shared/ui/markdown-editor';
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
  IterationId: 'ticket.iteration',
  EstimateMinutes: 'timeline.estimateMinutes',
  SlaBreachNotifiedAt: 'timeline.slaBreach',
};

// ─── Helpers de conversão ──────────────────────────────
function fromAudit(
  a: AuditLogResponse,
  t: ReturnType<typeof useTranslations>,
  formatFieldValue: (fieldName: string, value: string | null) => string,
  getActorName: (auditUserName: string | null, auditUserId: number | null) => string,
): TimelineEvent | null {
  if (a.action === 'Insert') return null;

  const actorName = getActorName(a.userName, a.userId ?? null);

  if (a.action !== 'Update') {
    return {
      id: `audit-${a.id}`,
      kind: 'audit',
      at: a.occurredAt,
      actor: actorName,
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
      actor: actorName,
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
    knownField.fieldName === 'IterationId' ? 'audit' :
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
    actor: actorName,
    title: `${fieldLabel}: ${oldVal} → ${newVal}`,
  };
}

function fromComment(
  c: TicketCommentResponse,
  t: ReturnType<typeof useTranslations>,
): TimelineEvent {
  return {
    id: `comment-${c.id}`,
    kind: 'comment',
    at: c.createdAt ?? new Date(0).toISOString(),
    actor: c.userName || 'Unknown',
    title: c.isInternal ? t('comments.internal') : t('comments.public'),
    detail: c.message,
    internal: c.isInternal,
  };
}

function fromWorklog(
  w: WorklogResponse,
  t: ReturnType<typeof useTranslations>,
): TimelineEvent {
  const h = Math.floor(w.durationMinutes / 60);
  const m = w.durationMinutes % 60;
  const dur = h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
  return {
    id: `worklog-${w.id}`,
    kind: 'worklog',
    at: w.startedAt ?? w.createdAt ?? new Date(0).toISOString(),
    actor: w.userName || 'Unknown',
    title: `${dur} — ${t(`timeline.worklogType.${w.type}`)}`,
    detail: w.description,
  };
}

// ─── Item individual da timeline ──────────────────────────────────────────────
function TimelineItem({
  ev,
  isLast,
  actorInitials,
  timeFmt,
  t,
}: {
  ev: TimelineEvent;
  isLast: boolean;
  actorInitials: (name: string | null) => string;
  timeFmt: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
}) {
  const [expanded, setExpanded] = useState(false);
  const meta = KIND_META[ev.kind];
  const Icon = meta.icon;
  const isComment = ev.kind === 'comment';
  const isAttachment = ev.kind === 'attachment';

  return (
    <li className={cn('relative pl-8', isLast ? 'pb-0' : 'pb-6')}>
      {/* Ícone na linha */}
      <span
        className={cn(
          'absolute -left-[15px] top-0 z-[1] flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg',
          meta.bg,
        )}
        title={ev.actor ?? t('timeline.system')}
      >
        {isComment
          ? <span className={cn('text-[10px] font-bold', meta.tone)}>{actorInitials(ev.actor)}</span>
          : <Icon className={cn('h-3.5 w-3.5', meta.tone)} aria-hidden />
        }
      </span>

      {/* Conteúdo */}
      <div className="flex flex-col gap-1 min-w-0 pt-0.5">
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-xs font-semibold text-text">{ev.actor ?? t('timeline.system')}</span>
          {!isComment && (
            <>
              <span className="text-dim">·</span>
              <span className="text-xs text-text/80">{ev.title}</span>
            </>
          )}
          <span className="text-[10px] text-dim tabular-nums ml-auto">{timeFmt.format(new Date(ev.at))}</span>
        </div>

        {isComment && (
          <div className={cn(
            'mt-1.5 rounded-xl border px-4 py-3',
            ev.internal ? 'border-warning/30 bg-warning/5' : 'border-border bg-panel',
          )}>
            {ev.internal && (
              <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning">
                <span className="h-1.5 w-1.5 rounded-full bg-warning" />{ev.title}
              </span>
            )}
            <MarkdownContent content={ev.detail ?? ''} imageAsChip />
          </div>
        )}

        {isAttachment && ev.detail && (
          <button
            type="button"
            onClick={() => setExpanded(p => !p)}
            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel px-2.5 py-1 text-xs text-dim hover:bg-panel-2 hover:text-text transition-colors self-start"
          >
            <Paperclip className="h-3 w-3" />
            <span className="max-w-[200px] truncate">{ev.detail}</span>
            {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          </button>
        )}

        {!isComment && !isAttachment && ev.detail && (
          <p className="text-xs text-dim leading-relaxed line-clamp-2">{ev.detail}</p>
        )}
      </div>
    </li>
  );
}

// ─── Componente principal ──────────────────────────────
export function TicketTimeline({
  ticket,
  userName,
  teamName,
}: {
  ticket: TicketDetailResponse;
  userName: (uid: number | null) => string;
  teamName?: (tid: number | null) => string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';

  const audit = useQuery({
    queryKey: ['audit', 'Ticket', ticket.id],
    queryFn: () => auditApi.forEntity('Ticket', ticket.id, 200),
    retry: false,
  });

  const iterations = useQuery({
    queryKey: ['iterations'],
    queryFn: () => iterationsApi.list(1, 100),
  });
  const iterationName = (id: number | null) => {
    if (!id) return '—';
    return (iterations.data ?? []).find((it) => it.id === id)?.name ?? `#${id}`;
  };

  // Parse audit userNames - they might come as IDs, try to get real names from context
  const getActorName = (auditUserName: string | null, auditUserId: number | null): string => {
    if (!auditUserName) return auditUserId ? userName(auditUserId) : 'System';
    // If it looks like a number, resolve by ID instead
    if (auditUserName && /^\d+$/.test(auditUserName) && auditUserId) {
      return userName(auditUserId);
    }
    return auditUserName;
  };

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

    if (fieldName === 'AssignedUserId' && !isNaN(Number(value))) {
      return userName(Number(value));
    }

    if (fieldName === 'AssignedTeamId' && !isNaN(Number(value))) {
      return teamName ? teamName(Number(value)) : value;
    }

    if (fieldName === 'EstimateMinutes' && !isNaN(Number(value))) {
      const mins = Number(value);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return h > 0 ? `${h}h${m > 0 ? ` ${m}min` : ''}` : `${m}min`;
    }

    if (fieldName === 'IterationId') {
      return iterationName(!isNaN(Number(value)) ? Number(value) : null);
    }

    if (fieldName === 'CustomerId' && !isNaN(Number(value))) {
      return userName(Number(value));
    }

    if (fieldName.endsWith('Id') && !isNaN(Number(value))) {
      return userName(Number(value)) || value;
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

    ticket.comments.forEach((c) => list.push(fromComment(c, t)));
    ticket.worklogs.forEach((w) => list.push(fromWorklog(w, t)));

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
      const ev = fromAudit(a, t, formatFieldValue, getActorName);
      if (ev && !seenIds.has(ev.id)) {
        seenIds.add(ev.id);
        list.push(ev);
      }
    });

    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [ticket, audit.data, attachments.data, iterations.data, userName, t, locale, timeZone]);

  // ─── Loading / Vazio ────────────────────────────────
  if (audit.isLoading) return <LoadingState label={t('timeline.loading')} />;
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center">
        <Activity className="h-10 w-10 opacity-20" />
        <p className="text-sm font-medium text-text">{t('timeline.empty')}</p>
      </div>
    );
  }

  // ─── Agrupamento por dia ─────────────────────────────
  const dayFmt = new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric', timeZone });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone });
  const todayKey = dayFmt.format(new Date());
  const yesterdayKey = dayFmt.format(new Date(Date.now() - 86_400_000));
  const dayLabel = (key: string) =>
    key === todayKey ? t('timeline.today') : key === yesterdayKey ? t('timeline.yesterday') : key;

  const groups: { day: string; events: TimelineEvent[] }[] = [];
  for (const ev of events) {
    const day = dayFmt.format(new Date(ev.at));
    const last = groups[groups.length - 1];
    if (last?.day === day) last.events.push(ev);
    else groups.push({ day, events: [ev] });
  }

  const actorInitials = (name: string | null) =>
    (name ?? '?').split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="w-full py-2">
      {groups.map((g) => (
        <section key={g.day} className="mb-8 last:mb-0">
          {/* Cabeçalho do dia */}
          <div className="sticky top-0 z-10 -mx-1 mb-4 flex items-center gap-3 bg-bg/90 px-1 py-2 backdrop-blur-sm">
            <div className="h-px flex-1 bg-border" />
            <span className="shrink-0 rounded-full border border-border bg-panel px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-dim">
              {dayLabel(g.day)}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Lista de eventos */}
          <ol className="relative ml-4 border-l border-border/60">
            {g.events.map((ev, idx) => (
              <TimelineItem key={ev.id} ev={ev} isLast={idx === g.events.length - 1} actorInitials={actorInitials} timeFmt={timeFmt} t={t} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}