'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, Clock, Info, Send, Lock, Timer, Sparkles, User, Users,
  Lightbulb, GitBranch, ChevronDown, UserPlus, Plus, Check, History, Paperclip, X, FlaskConical,
} from 'lucide-react';
import { ticketsApi, usersApi, teamsApi, intelligenceApi, worklogsApi } from '@/shared/api/endpoints';
import { TicketStatus, STATUS_TRANSITIONS, apiErrorMessage, type TicketStatusValue, type TicketStatusName } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { PriorityBadge, StatusBadge } from './badges';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { SlaPanel } from './sla-panel';
import { TicketTimeline } from './timeline';
import { InvestigationTab } from './investigation-tab';
import { AttachmentsTab } from './attachments';

type SubTab = 'overview' | 'timeline' | 'conversation' | 'worklogs' | 'investigation' | 'attachments' | 'intelligence';

export function TicketDetail({ id }: { id: number }) {
  const locale = useLocale() as Locale;
  const tSla = useTranslations('sla');
  const tTicket = useTranslations('ticket');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>('overview');

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketsApi.get(id),
  });
  const { data: sla } = useQuery({ queryKey: ['tickets', 'sla', id], queryFn: () => ticketsApi.getSla(id), enabled: !!ticket });
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 100) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const userOptions: ComboOption[] = (users.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));
  const userName = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.name ?? `#${uid}` : '—');
  const teamName = (tid: number | null) => (tid ? teams.data?.find((t) => t.id === tid)?.name ?? `#${tid}` : '—');

  const userEmail = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.email ?? null : null);

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatusValue) => ticketsApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success(tTicket('statusUpdated'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, tTicket('statusError'))),
  });

  if (isLoading) return <LoadingState label={tTicket('loading')} />;
  if (isError || !ticket)
    return <ErrorState title={tTicket('loadError')} onRetry={() => refetch()} retryLabel={tTicket('retry')} />;

  const tabs: { key: SubTab; label: string; icon: typeof Info; count?: number }[] = [
    { key: 'overview', label: tTicket('tabOverview'), icon: Info },
    { key: 'timeline', label: tTicket('tabTimeline'), icon: History },
    { key: 'conversation', label: tTicket('tabConversation'), icon: MessageSquare, count: ticket.comments.length },
    { key: 'worklogs', label: tTicket('tabWorklogs'), icon: Clock, count: ticket.worklogs.length },
    { key: 'investigation', label: tTicket('tabInvestigation'), icon: FlaskConical, count: ticket.investigations.length },
    { key: 'attachments', label: tTicket('tabAttachments'), icon: Paperclip },
    { key: 'intelligence', label: tTicket('tabIntelligence'), icon: Sparkles },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header — padrão corporativo (Jira / Azure DevOps style):
            Linha 1: número + título grande   |  ações
            Linha 2: badges + meta (aberto/fechado) */}
      <div className="border-b border-border bg-bg-subtle/30 px-lg pt-lg pb-md">
        <div className="flex flex-wrap items-start gap-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-sm">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                {ticket.number}
              </span>
            </div>
            <h1 className="mt-1 truncate text-2xl font-bold leading-tight">{ticket.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-sm">
            <Can permission="ticket.assign">
              <AssignControl
                ticketId={id}
                currentUserId={ticket.assignedUserId}
                currentUserName={ticket.assignedUserId ? userName(ticket.assignedUserId) : null}
                currentUserEmail={userEmail(ticket.assignedUserId)}
                userOptions={userOptions}
                resolveUserTeam={(uid) => users.data?.items.find((u) => u.id === uid)?.teamId ?? null}
              />
            </Can>
            <Can permission="ticket.status">
              <StatusPicker value={ticket.status} disabled={changeStatus.isPending} onChange={(v) => changeStatus.mutate(v)} />
            </Can>
          </div>
        </div>

        {/* Linha de meta */}
        <div className="mt-md flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-dim">·</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden />
            {tTicket('openedAt')} {formatDateTime(ticket.openedAt, { locale, timeZone })}
          </span>
          {ticket.closedAt && (
            <>
              <span className="text-dim">·</span>
              <span className="inline-flex items-center gap-1 text-success">
                <Check className="h-3 w-3" aria-hidden />
                {tTicket('closedAt')} {formatDateTime(ticket.closedAt, { locale, timeZone })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Tab bar — separada do header para hierarquia visual mais clara */}
      <div className="flex gap-1 overflow-x-auto border-b border-border px-lg">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setSub(tb.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-md py-2 text-sm transition-colors',
              sub === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-text',
            )}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
            {tb.count !== undefined && tb.count > 0 && (
              <span className="rounded-full bg-panel-2 px-1.5 text-xs text-dim">{tb.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {sub === 'overview' && (
          <div className="grid items-start gap-lg lg:grid-cols-3">
            <div className="flex flex-col gap-lg lg:col-span-2">
              <div>
                <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('description')}</p>
                <div className="card-surface min-h-[140px] whitespace-pre-wrap p-lg text-sm leading-relaxed text-text">
                  {ticket.description || '—'}
                </div>
              </div>
              {/* Recomendações inteligentes (aceitar / ignorar) */}
              <RecommendationsPanel ticketId={id} onOpenIntelligence={() => setSub('intelligence')} />
            </div>
            <aside>
              <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('details')}</p>
              <div className="card-surface flex flex-col gap-3 p-lg text-sm">
                <Detail icon={User} label={tTicket('requester')} value={userName(ticket.customerId)} />
                <Detail icon={UserPlus} label={tTicket('assignee')} value={userName(ticket.assignedUserId)} />
                <Detail icon={Users} label={tTicket('team')} value={teamName(ticket.assignedTeamId)} />
                <Detail icon={Clock} label={tTicket('openedAt')} value={formatDateTime(ticket.openedAt, { locale, timeZone })} />
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-dim">
                    <Timer className="h-3.5 w-3.5" /> {tSla('label')}
                  </p>
                  <SlaPanel sla={sla} />
                </div>
                {/* Tracking de tempo (estilo Azure) */}
                <div className="border-t border-border pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-dim">
                    <Clock className="h-3.5 w-3.5" /> {tTicket('tabWorklogs')}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <TrackMini label="Est." value={fmtMin(ticket.estimateMinutes ?? 0)} />
                    <TrackMini label="Feito" value={fmtMin(ticket.completedMinutes)} accent="primary" />
                    <TrackMini
                      label="Resta"
                      value={fmtMin(
                        ticket.remainingMinutes != null
                          ? Math.max(0, ticket.remainingMinutes)
                          : Math.max(0, (ticket.estimateMinutes ?? 0) - ticket.completedMinutes),
                      )}
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}

        {sub === 'timeline' && <TicketTimeline ticket={ticket} userName={userName} />}

        {sub === 'conversation' && <Conversation ticketId={id} comments={ticket.comments} userName={userName} locale={locale} timeZone={timeZone} />}

        {sub === 'worklogs' && (
          <WorklogsTab
            ticketId={id}
            worklogs={ticket.worklogs}
            userName={userName}
            estimateMinutesServer={ticket.estimateMinutes}
            remainingMinutesServer={ticket.remainingMinutes}
            completedMinutesServer={ticket.completedMinutes}
          />
        )}

        {sub === 'investigation' && <InvestigationTab ticketId={id} investigations={ticket.investigations} />}

        {sub === 'attachments' && <AttachmentsTab ticketId={id} userName={userName} />}

        {sub === 'intelligence' && <IntelligencePanel ticketId={id} />}
      </div>
    </div>
  );
}

/* ---- Status picker (substitui o select) ---- */
function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: TicketStatusName;
  onChange: (v: TicketStatusValue) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Só transições válidas (RN-003) + o status atual.
  const options = [value, ...STATUS_TRANSITIONS[value]];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-sm hover:border-border-strong disabled:opacity-50"
      >
        <StatusBadge status={value} />
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border border-border bg-panel py-1 shadow-lg">
            {options.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  if (name !== value) onChange(TicketStatus[name]);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-md py-1.5 text-left hover:bg-panel-2"
              >
                <StatusBadge status={name} />
                {name === value && <Check className="h-4 w-4 text-primary" aria-hidden />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Atribuir responsável (popover): só usuário; a equipe é herdada dele ---- */
function AssignControl({
  ticketId,
  currentUserId,
  currentUserName,
  currentUserEmail,
  userOptions,
  resolveUserTeam,
}: {
  ticketId: number;
  currentUserId: number | null;
  currentUserName: string | null;
  currentUserEmail: string | null;
  userOptions: ComboOption[];
  resolveUserTeam: (userId: number) => number | null;
}) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<number | null>(currentUserId);

  const assign = useMutation({
    // Equipe atribuída automaticamente a partir do usuário escolhido.
    mutationFn: () => ticketsApi.assign(ticketId, userId!, resolveUserTeam(userId!)),
    onSuccess: () => {
      toast.success(t('assignedOk'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('assignError'))),
  });

  const initials = (currentUserName ?? '?').split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-md border bg-panel text-sm transition-colors hover:border-border-strong',
          currentUserId ? 'border-border pl-1 pr-2.5' : 'border-dashed border-border px-3 text-muted',
        )}
        title={currentUserId ? `${currentUserName}${currentUserEmail ? ` · ${currentUserEmail}` : ''}` : t('assign')}
      >
        {currentUserId ? (
          <>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">
              {initials || '?'}
            </span>
            <span className="max-w-[140px] truncate font-medium text-text">{currentUserName}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden />
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden /> {t('assign')}
          </>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-1 w-80 rounded-md border border-border bg-panel p-md shadow-lg">
            <p className="mb-1.5 text-xs font-medium text-muted">{t('assignee')}</p>
            <AsyncCombobox options={userOptions} value={userId} onChange={setUserId} placeholder={t('selectUser')} allowClear={false} />
            <p className="mt-1.5 text-xs text-dim">{t('teamAutoHint')}</p>
            <Button className="mt-md w-full justify-center" disabled={!userId || assign.isPending} loading={assign.isPending} onClick={() => assign.mutate()}>
              {t('assign')}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-dim" aria-hidden />
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-dim">{label}</p>
        <p className="truncate text-text">{value}</p>
      </div>
    </div>
  );
}

function TrackMini({ label, value, accent }: { label: string; value: string; accent?: 'primary' }) {
  return (
    <div className="rounded-md bg-panel-2/50 px-1 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className={cn('text-sm font-bold', accent === 'primary' ? 'text-primary' : 'text-text')}>{value}</p>
    </div>
  );
}

/**
 * Painel de recomendações inteligentes na visão geral: busca resoluções similares
 * (motor de IA) e permite Aceitar (helpful) ou Ignorar — fecha o loop de aprendizado
 * via POST /tickets/{id}/recommendation-feedback.
 */
function RecommendationsPanel({ ticketId, onOpenIntelligence }: { ticketId: number; onOpenIntelligence: () => void }) {
  const qc = useQueryClient();
  const [handled, setHandled] = useState<Record<number, 'accepted' | 'ignored'>>({});

  const report = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
    retry: false,
  });

  const feedback = useMutation({
    mutationFn: (v: { resolutionId: number; accepted: boolean }) =>
      ticketsApi.recommendationFeedback(ticketId, { resolutionId: v.resolutionId, accepted: v.accepted, helpful: v.accepted }),
    onSuccess: (_d, v) => {
      setHandled((h) => ({ ...h, [v.resolutionId]: v.accepted ? 'accepted' : 'ignored' }));
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      toast.success(v.accepted ? 'Recomendação aceita' : 'Recomendação ignorada');
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível registrar o feedback')),
  });

  const suggestions = (report.data?.resolutionSuggestions ?? []).slice(0, 3);
  if (report.isLoading || suggestions.length === 0) return null; // só aparece quando há sinal

  return (
    <div>
      <div className="mb-sm flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Recomendações inteligentes
        </p>
        <button type="button" onClick={onOpenIntelligence} className="text-xs text-primary hover:underline">
          Ver análise completa
        </button>
      </div>
      <div className="flex flex-col gap-sm">
        {suggestions.map((r) => {
          const state = handled[r.resolutionId];
          return (
            <div
              key={r.resolutionId}
              className={cn(
                'card-surface flex items-center gap-sm p-md transition-opacity',
                state === 'ignored' && 'opacity-50',
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                <Lightbulb className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.summary}</p>
                <p className="text-xs text-dim">
                  {Math.round(r.similarityScore * 100)}% similar · {Math.round(r.successRate * 100)}% sucesso · {r.reusedCount}× reuso
                </p>
              </div>
              {state ? (
                <span
                  className={cn(
                    'shrink-0 rounded px-2 py-0.5 text-xs font-semibold',
                    state === 'accepted' ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim',
                  )}
                >
                  {state === 'accepted' ? 'Aceita' : 'Ignorada'}
                </span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: true })}
                    disabled={feedback.isPending}
                    className="grid h-7 w-7 place-items-center rounded-md text-success hover:bg-success/10"
                    aria-label="Aceitar"
                    title="Aceitar"
                  >
                    <Check className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: false })}
                    disabled={feedback.isPending}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-panel-2"
                    aria-label="Ignorar"
                    title="Ignorar"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Tempo (timetracker) ---- */
function useWorklogTypes() {
  const t = useTranslations('worklogType');
  return [
    { value: 1, label: t('investigation') },
    { value: 2, label: t('meeting') },
    { value: 3, label: t('development') },
    { value: 4, label: t('validation') },
    { value: 5, label: t('customerSupport') },
    { value: 6, label: t('documentation') },
    { value: 7, label: t('other') },
  ];
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function WorklogsTab({
  ticketId,
  worklogs,
  userName,
  estimateMinutesServer,
  remainingMinutesServer,
  completedMinutesServer,
}: {
  ticketId: number;
  worklogs: { id: number; userId: number; type: string; description: string; durationMinutes: number; startedAt: string | null }[];
  userName: (id: number | null) => string;
  estimateMinutesServer: number | null;
  remainingMinutesServer: number | null;
  completedMinutesServer: number;
}) {
  const t = useTranslations('worklog');
  const types = useWorklogTypes();
  const qc = useQueryClient();
  const [type, setType] = useState(3);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  // "Completed" vem do server (Sum(worklogs)), com fallback no array recém-carregado.
  const totalMin = completedMinutesServer || worklogs.reduce((acc, w) => acc + (w.durationMinutes || 0), 0);
  const duration = (Number(hours) || 0) * 60 + (Number(minutes) || 0);

  // Estimate/Remaining vêm do server (PATCH /tickets/{id}/tracking).
  const estimateMin = Math.max(0, estimateMinutesServer ?? 0);
  const remainingMin =
    remainingMinutesServer != null ? Math.max(0, remainingMinutesServer) : Math.max(0, estimateMin - totalMin);
  const overMin = Math.max(0, totalMin - estimateMin);
  const progress = estimateMin > 0 ? Math.min(100, (totalMin / estimateMin) * 100) : 0;
  const isOver = overMin > 0;

  const [estimateInput, setEstimateInput] = useState<string>(estimateMin > 0 ? String(estimateMin / 60) : '');
  const [remainingInput, setRemainingInput] = useState<string>(
    remainingMinutesServer != null ? String(remainingMinutesServer / 60) : '',
  );

  const saveTracking = useMutation({
    mutationFn: () =>
      ticketsApi.updateTracking(ticketId, {
        estimateMinutes: estimateInput.trim() === '' ? null : Math.round(Number(estimateInput) * 60),
        remainingMinutes: remainingInput.trim() === '' ? null : Math.round(Number(remainingInput) * 60),
      }),
    onSuccess: () => {
      toast.success('Tracking atualizado');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível atualizar')),
  });

  // Resumo por pessoa (estilo Azure Boards: tempo lançado por usuário).
  const perUser = Object.values(
    worklogs.reduce<Record<number, { userId: number; minutes: number; count: number }>>((acc, w) => {
      acc[w.userId] ??= { userId: w.userId, minutes: 0, count: 0 };
      acc[w.userId].minutes += w.durationMinutes || 0;
      acc[w.userId].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.minutes - a.minutes);
  const perUserMax = Math.max(1, ...perUser.map((u) => u.minutes));

  const log = useMutation({
    mutationFn: async () => {
      const created = await worklogsApi.create(ticketId, { type, description: description.trim(), startedAt: new Date().toISOString() });
      await worklogsApi.updateDuration(created.id, duration);
      return created;
    },
    onSuccess: () => {
      toast.success(t('loggedOk'));
      setDescription('');
      setHours('');
      setMinutes('');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('logError'))),
  });

  const canLog = description.trim().length > 0 && duration > 0;

  return (
    <div className="flex flex-col gap-lg">
      <Can permission="worklog.create">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canLog) log.mutate();
          }}
          className="card-surface flex flex-wrap items-end gap-sm p-md"
        >
          <label className="flex w-44 flex-col gap-1 text-xs text-muted">
            {t('type')}
            <Select value={type} onChange={setType} options={types} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted" style={{ minWidth: 180 }}>
            {t('what')}
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPh')} />
          </label>
          <label className="flex w-20 flex-col gap-1 text-xs text-muted">
            {t('hours')}
            <Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
          </label>
          <label className="flex w-20 flex-col gap-1 text-xs text-muted">
            {t('minutes')}
            <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" />
          </label>
          <Button type="submit" disabled={!canLog} loading={log.isPending}>
            <Plus className="h-4 w-4" /> {t('log')}
          </Button>
        </form>
      </Can>

      {/* Painel estilo Azure 7pace: Estimate / Completed / Remaining + barra */}
      <div className="card-surface p-lg">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <KpiTile label="Estimate" value={fmtMin(estimateMin)} hint={estimateMin ? '' : 'defina abaixo'} />
          <KpiTile label="Completed work" value={fmtMin(totalMin)} accent="primary" />
          <KpiTile
            label="Remaining"
            value={isOver ? `+${fmtMin(overMin)}` : fmtMin(remainingMin)}
            accent={isOver ? 'danger' : remainingMin === 0 && estimateMin > 0 ? 'success' : undefined}
          />
        </div>

        <div className="mt-md">
          <div className="mb-1 flex items-center justify-between text-xs text-muted">
            <span>Progresso</span>
            <span>{estimateMin > 0 ? `${Math.round(progress)}%` : '—'}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-panel-2">
            <div
              className={cn('h-full rounded-full transition-all', isOver ? 'bg-danger' : 'bg-primary')}
              style={{ width: `${estimateMin > 0 ? progress : 0}%` }}
            />
          </div>
        </div>

        <div className="mt-md flex flex-wrap items-end gap-sm">
          <label className="flex w-32 flex-col gap-1 text-xs text-muted">
            Estimativa (h)
            <Input
              type="number"
              min={0}
              step="0.5"
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
              placeholder="0"
            />
          </label>
          <label className="flex w-32 flex-col gap-1 text-xs text-muted">
            Restante (h)
            <Input
              type="number"
              min={0}
              step="0.5"
              value={remainingInput}
              onChange={(e) => setRemainingInput(e.target.value)}
              placeholder="auto"
            />
          </label>
          <Button type="button" variant="secondary" onClick={() => saveTracking.mutate()} loading={saveTracking.isPending}>
            Salvar tracking
          </Button>
        </div>
      </div>

      {/* Distribuição por pessoa (barras) */}
      <div>
        <div className="mb-sm flex items-center justify-between">
          <p className="text-sm font-semibold">{t('byPerson')}</p>
          <span className="text-sm text-muted">{t('total')}: <strong className="text-text">{fmtMin(totalMin)}</strong></span>
        </div>
        {perUser.length === 0 ? (
          <p className="text-sm text-dim">{t('emptyPerson')}</p>
        ) : (
          <div className="card-surface flex flex-col gap-2.5 p-md">
            {perUser.map((u) => (
              <div key={u.userId} className="flex items-center gap-sm">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                  {initials(userName(u.userId)) || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="truncate font-medium">{userName(u.userId)}</span>
                    <span className="shrink-0 text-primary">{fmtMin(u.minutes)}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(u.minutes / perUserMax) * 100}%` }} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-dim">{t('entries', { count: u.count })}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lançamentos detalhados */}
      {worklogs.length > 0 && (
        <div>
          <p className="mb-sm text-sm font-semibold">{t('entriesTitle')}</p>
          <div className="flex flex-col gap-sm">
            {worklogs.map((w) => (
              <div key={w.id} className="card-surface flex items-center gap-sm p-md">
                <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-xs font-medium text-muted">{w.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{w.description || '—'}</p>
                  <p className="text-xs text-dim">
                    {userName(w.userId)}
                    {w.startedAt && <> · {new Date(w.startedAt).toLocaleString()}</>}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">{fmtMin(w.durationMinutes)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: 'primary' | 'success' | 'danger';
}) {
  return (
    <div className="rounded-md border border-border bg-panel-2/40 p-md">
      <p className="text-[11px] uppercase tracking-wide text-dim">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-bold',
          accent === 'primary' && 'text-primary',
          accent === 'success' && 'text-success',
          accent === 'danger' && 'text-danger',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-[11px] text-dim">{hint}</p>}
    </div>
  );
}

/* ---- Inteligência ---- */
function IntelligencePanel({ ticketId }: { ticketId: number }) {
  const t = useTranslations('intelligence');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
  });

  if (isLoading) return <LoadingState label={t('analyzing')} />;
  if (isError || !data)
    return <ErrorState title={t('analysisError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  return (
    <div className="flex flex-col gap-lg">
      <section>
        <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-primary" /> {t('rootCauses')}
        </p>
        {data.rootCauseCandidates.length === 0 ? (
          <p className="text-sm text-dim">{t('noSignal')}</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {data.rootCauseCandidates.map((c, i) => (
              <li key={i} className="card-surface p-md">
                <div className="flex items-center gap-sm">
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs font-medium text-muted">{c.category}</span>
                  {c.aiEnhanced && <span className="inline-flex items-center gap-1 text-xs text-primary"><Sparkles className="h-3 w-3" /> {t('ai')}</span>}
                  <span className="ml-auto rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    {Math.round(c.confidenceScore * 100)}%
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{c.description}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
          <Lightbulb className="h-4 w-4 text-warning" /> {t('resolutions')}
        </p>
        {data.resolutionSuggestions.length === 0 ? (
          <p className="text-sm text-dim">{t('noResolutions')}</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {data.resolutionSuggestions.map((r) => (
              <li key={r.resolutionId} className="card-surface p-md">
                <div className="flex items-center gap-sm">
                  <span className="flex-1 text-sm">{r.summary}</span>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success">
                    {Math.round(r.similarityScore * 100)}%
                  </span>
                </div>
                <p className="mt-1 text-xs text-dim">{t('reused', { count: r.reusedCount })} · {t('success')} {Math.round(r.successRate * 100)}%</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type CommentFilter = 'all' | 'public' | 'internal';

function Conversation({
  ticketId,
  comments,
  userName,
  locale,
  timeZone,
}: {
  ticketId: number;
  comments: { id: number; userId: number; message: string; isInternal: boolean; createdAt: string | null }[];
  userName: (id: number | null) => string;
  locale: Locale;
  timeZone: string;
}) {
  const t = useTranslations('comments');
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<CommentFilter>('all');

  const add = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, text.trim(), internal),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('addError'))),
  });

  const filtered = comments.filter((c) =>
    filter === 'all' ? true : filter === 'internal' ? c.isInternal : !c.isInternal,
  );
  const counts = {
    all: comments.length,
    public: comments.filter((c) => !c.isInternal).length,
    internal: comments.filter((c) => c.isInternal).length,
  };

  return (
    <div className="flex h-full w-full flex-col gap-md">
      <div className="flex items-center gap-1 text-xs">
        {(['all', 'public', 'internal'] as CommentFilter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-full border px-2.5 py-1 transition-colors',
              filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-text',
            )}
          >
            {t(`filter.${f}`)} · {counts[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-sm">
        {filtered.length === 0 ? (
          <p className="text-sm text-dim">{t('empty')}</p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className={cn(
                'card-surface p-md',
                c.isInternal ? 'border-warning/40 bg-warning/5' : 'border-l-2 border-l-primary/40',
              )}
            >
              <div className="mb-1 flex items-center gap-sm text-xs text-muted">
                <span className="font-medium text-text">{userName(c.userId)}</span>
                {c.isInternal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-warning">
                    <Lock className="h-3 w-3" /> {t('internal')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">
                    {t('public')}
                  </span>
                )}
                {c.createdAt && <span className="text-dim">{formatDateTime(c.createdAt, { locale, timeZone })}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.message}</p>
            </div>
          ))
        )}
      </div>

      <Can permission="ticket.comment.add">
        <div className={cn('card-surface p-md', internal && 'border-warning/40 bg-warning/5')}>
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={internal ? t('placeholderInternal') : t('placeholderPublic')}
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim"
          />
          <div className="mt-sm flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              <Lock className="h-3 w-3" /> {t('internalToggle')}
            </label>
            <Button size="sm" disabled={!text.trim() || add.isPending} loading={add.isPending} onClick={() => add.mutate()}>
              <Send className="h-3.5 w-3.5" /> {t('submit')}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}
