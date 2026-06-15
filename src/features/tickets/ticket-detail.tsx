'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, Clock, Info, Send, Lock, ShieldAlert, Timer, Sparkles, User, Users,
  Lightbulb, GitBranch, ChevronDown, UserPlus, Plus, Check,
} from 'lucide-react';
import { ticketsApi, usersApi, teamsApi, intelligenceApi, worklogsApi } from '@/shared/api/endpoints';
import { TicketStatus, STATUS_TRANSITIONS, apiErrorMessage, type TicketStatusValue, type TicketStatusName, type SlaSnapshotResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { PriorityBadge, StatusBadge, STATUS_LABEL } from './badges';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';

type SubTab = 'overview' | 'conversation' | 'worklogs' | 'intelligence';

const SLA_STYLE: Record<SlaSnapshotResponse['status'], string> = {
  OnTrack: 'text-success',
  AtRisk: 'text-warning',
  Breached: 'text-danger',
  None: 'text-dim',
};

export function TicketDetail({ id }: { id: number }) {
  const locale = useLocale() as Locale;
  const tSla = useTranslations('sla');
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
  const teamOptions: ComboOption[] = (teams.data ?? []).map((t) => ({ id: t.id, label: t.name }));
  const userName = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.name ?? `#${uid}` : '—');
  const teamName = (tid: number | null) => (tid ? teams.data?.find((t) => t.id === tid)?.name ?? `#${tid}` : '—');

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatusValue) => ticketsApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível mudar o status')),
  });

  if (isLoading) return <LoadingState label="Carregando ticket…" />;
  if (isError || !ticket)
    return <ErrorState title="Erro ao carregar o ticket" onRetry={() => refetch()} retryLabel="Tentar de novo" />;

  const tabs: { key: SubTab; label: string; icon: typeof Info; count?: number }[] = [
    { key: 'overview', label: 'Visão geral', icon: Info },
    { key: 'conversation', label: 'Conversa', icon: MessageSquare, count: ticket.comments.length },
    { key: 'worklogs', label: 'Tempo', icon: Clock, count: ticket.worklogs.length },
    { key: 'intelligence', label: 'Inteligência', icon: Sparkles },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-lg pt-lg">
        {/* Linha 1: número + ações */}
        <div className="flex items-center gap-sm">
          <span className="font-mono text-xs font-semibold text-primary">{ticket.number}</span>
          <div className="ml-auto flex items-center gap-sm">
            <Can permission="ticket.assign">
              <AssignControl
                ticketId={id}
                currentUserId={ticket.assignedUserId}
                currentTeamId={ticket.assignedTeamId}
                userOptions={userOptions}
                teamOptions={teamOptions}
              />
            </Can>
            <Can permission="ticket.status">
              <StatusPicker value={ticket.status} disabled={changeStatus.isPending} onChange={(v) => changeStatus.mutate(v)} />
            </Can>
          </div>
        </div>

        {/* Título */}
        <h1 className="mt-1 text-2xl font-bold leading-tight">{ticket.title}</h1>

        {/* Meta: status, prioridade, responsável */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-dim">·</span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <UserPlus className="h-3.5 w-3.5" aria-hidden />
            {ticket.assignedUserId ? userName(ticket.assignedUserId) : 'Não atribuído'}
          </span>
        </div>

        <div className="mt-md flex gap-1 overflow-x-auto">
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
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {sub === 'overview' && (
          <div className="grid items-start gap-lg lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">Descrição</p>
              <div className="card-surface min-h-[160px] whitespace-pre-wrap p-lg text-sm leading-relaxed text-text">
                {ticket.description || '—'}
              </div>
            </div>
            <aside>
              <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">Detalhes</p>
              <div className="card-surface flex flex-col gap-3 p-lg text-sm">
                <Detail icon={User} label="Solicitante" value={userName(ticket.customerId)} />
                <Detail icon={UserPlus} label="Responsável" value={userName(ticket.assignedUserId)} />
                <Detail icon={Users} label="Equipe" value={teamName(ticket.assignedTeamId)} />
                <Detail icon={Clock} label="Aberto em" value={formatDateTime(ticket.openedAt, { locale, timeZone })} />
                <div className="border-t border-border pt-3">
                  <p className="mb-1 flex items-center gap-1.5 text-xs uppercase tracking-wide text-dim">
                    <Timer className="h-3.5 w-3.5" /> {tSla('label')}
                  </p>
                  {sla ? (
                    <span className={cn('inline-flex flex-wrap items-center gap-1.5 text-sm font-medium', SLA_STYLE[sla.status])}>
                      {sla.status === 'Breached' ? <ShieldAlert className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
                      {tSla(sla.status)}
                      {sla.dueAt && (
                        <span className="text-dim">· {tSla('due')} {formatDateTime(sla.dueAt, { locale, timeZone })}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-dim">—</span>
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}

        {sub === 'conversation' && <Conversation ticketId={id} comments={ticket.comments} userName={userName} locale={locale} timeZone={timeZone} />}

        {sub === 'worklogs' && (
          <WorklogsTab ticketId={id} worklogs={ticket.worklogs} userName={userName} />
        )}

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
        className="inline-flex items-center gap-2 rounded-md border border-border bg-panel px-2 py-1.5 text-sm hover:border-border-strong disabled:opacity-50"
      >
        <StatusBadge status={value} />
        <ChevronDown className="h-3.5 w-3.5 text-dim" aria-hidden />
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

/* ---- Atribuir responsável (popover) ---- */
function AssignControl({
  ticketId,
  currentUserId,
  currentTeamId,
  userOptions,
  teamOptions,
}: {
  ticketId: number;
  currentUserId: number | null;
  currentTeamId: number | null;
  userOptions: ComboOption[];
  teamOptions: ComboOption[];
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<number | null>(currentUserId);
  const [teamId, setTeamId] = useState<number | null>(currentTeamId);

  const assign = useMutation({
    mutationFn: () => ticketsApi.assign(ticketId, userId!, teamId),
    onSuccess: () => {
      toast.success('Ticket atribuído');
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setOpen(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível atribuir')),
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-panel px-md py-1.5 text-sm text-muted hover:border-border-strong hover:text-text"
      >
        <UserPlus className="h-4 w-4" aria-hidden /> Atribuir
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-40 mt-1 w-72 rounded-md border border-border bg-panel p-md shadow-lg">
            <p className="mb-1.5 text-xs font-medium text-muted">Responsável</p>
            <AsyncCombobox options={userOptions} value={userId} onChange={setUserId} placeholder="Selecionar usuário" allowClear={false} />
            <p className="mb-1.5 mt-md text-xs font-medium text-muted">Equipe (opcional)</p>
            <AsyncCombobox options={teamOptions} value={teamId} onChange={setTeamId} placeholder="Selecionar equipe" />
            <Button className="mt-md w-full justify-center" disabled={!userId || assign.isPending} loading={assign.isPending} onClick={() => assign.mutate()}>
              Atribuir
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

/* ---- Tempo (timetracker) ---- */
const WORKLOG_TYPES: { value: number; label: string }[] = [
  { value: 1, label: 'Investigação' },
  { value: 2, label: 'Reunião' },
  { value: 3, label: 'Desenvolvimento' },
  { value: 4, label: 'Validação' },
  { value: 5, label: 'Atendimento' },
  { value: 6, label: 'Documentação' },
  { value: 7, label: 'Outro' },
];

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
}: {
  ticketId: number;
  worklogs: { id: number; userId: number; type: string; description: string; durationMinutes: number }[];
  userName: (id: number | null) => string;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState(3);
  const [description, setDescription] = useState('');
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');

  const totalMin = worklogs.reduce((acc, w) => acc + (w.durationMinutes || 0), 0);
  const duration = (Number(hours) || 0) * 60 + (Number(minutes) || 0);

  // Resumo por pessoa (estilo Azure Boards: tempo lançado por usuário).
  const perUser = Object.values(
    worklogs.reduce<Record<number, { userId: number; minutes: number; count: number }>>((acc, w) => {
      acc[w.userId] ??= { userId: w.userId, minutes: 0, count: 0 };
      acc[w.userId].minutes += w.durationMinutes || 0;
      acc[w.userId].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.minutes - a.minutes);

  const log = useMutation({
    mutationFn: async () => {
      const created = await worklogsApi.create(ticketId, { type, description: description.trim(), startedAt: new Date().toISOString() });
      await worklogsApi.updateDuration(created.id, duration);
      return created;
    },
    onSuccess: () => {
      toast.success('Tempo registrado');
      setDescription('');
      setHours('');
      setMinutes('');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível registrar o tempo')),
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
            Tipo
            <Select value={type} onChange={setType} options={WORKLOG_TYPES} />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-xs text-muted" style={{ minWidth: 180 }}>
            O que foi feito
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do trabalho" />
          </label>
          <label className="flex w-20 flex-col gap-1 text-xs text-muted">
            Horas
            <Input type="number" min={0} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0" />
          </label>
          <label className="flex w-20 flex-col gap-1 text-xs text-muted">
            Minutos
            <Input type="number" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="0" />
          </label>
          <Button type="submit" disabled={!canLog} loading={log.isPending}>
            <Plus className="h-4 w-4" /> Registrar
          </Button>
        </form>
      </Can>

      {/* Resumo por pessoa */}
      <div>
        <div className="mb-sm flex items-center justify-between">
          <p className="text-sm font-semibold">Tempo por pessoa</p>
          <span className="text-sm text-muted">Total: <strong className="text-text">{fmtMin(totalMin)}</strong></span>
        </div>
        {perUser.length === 0 ? (
          <p className="text-sm text-dim">Nenhum tempo registrado ainda.</p>
        ) : (
          <div className="grid gap-sm sm:grid-cols-2">
            {perUser.map((u) => (
              <div key={u.userId} className="card-surface flex items-center gap-sm p-md">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg">
                  {initials(userName(u.userId)) || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{userName(u.userId)}</p>
                  <p className="text-xs text-dim">{u.count} lançamento(s)</p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">{fmtMin(u.minutes)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lançamentos detalhados */}
      {worklogs.length > 0 && (
        <div>
          <p className="mb-sm text-sm font-semibold">Lançamentos</p>
          <div className="flex flex-col gap-sm">
            {worklogs.map((w) => (
              <div key={w.id} className="card-surface flex items-center gap-sm p-md">
                <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-xs font-medium text-muted">{w.type}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{w.description || '—'}</p>
                  <p className="text-xs text-dim">{userName(w.userId)}</p>
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

/* ---- Inteligência ---- */
function IntelligencePanel({ ticketId }: { ticketId: number }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
  });

  if (isLoading) return <LoadingState label="Analisando a demanda…" />;
  if (isError || !data)
    return <ErrorState title="Não foi possível analisar" onRetry={() => refetch()} retryLabel="Tentar de novo" />;

  return (
    <div className="flex flex-col gap-lg">
      <section>
        <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-primary" /> Causas raiz prováveis
        </p>
        {data.rootCauseCandidates.length === 0 ? (
          <p className="text-sm text-dim">Sem sinal suficiente no histórico.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {data.rootCauseCandidates.map((c, i) => (
              <li key={i} className="card-surface p-md">
                <div className="flex items-center gap-sm">
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs font-medium text-muted">{c.category}</span>
                  {c.aiEnhanced && <span className="inline-flex items-center gap-1 text-xs text-primary"><Sparkles className="h-3 w-3" /> IA</span>}
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
          <Lightbulb className="h-4 w-4 text-warning" /> Resoluções recomendadas
        </p>
        {data.resolutionSuggestions.length === 0 ? (
          <p className="text-sm text-dim">Nenhuma resolução similar encontrada.</p>
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
                <p className="mt-1 text-xs text-dim">Reusada {r.reusedCount}× · sucesso {Math.round(r.successRate * 100)}%</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

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
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);

  const add = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, text.trim(), internal),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível comentar')),
  });

  return (
    <div className="flex h-full w-full flex-col gap-md">
      <div className="flex flex-1 flex-col gap-sm">
        {comments.length === 0 ? (
          <p className="text-sm text-dim">Sem comentários ainda.</p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className={cn('card-surface p-md', c.isInternal && 'border-warning/40 bg-warning/5')}>
              <div className="mb-1 flex items-center gap-sm text-xs text-muted">
                <span className="font-medium text-text">{userName(c.userId)}</span>
                {c.isInternal && <span className="inline-flex items-center gap-1 text-warning"><Lock className="h-3 w-3" /> interno</span>}
                {c.createdAt && <span className="text-dim">{formatDateTime(c.createdAt, { locale, timeZone })}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.message}</p>
            </div>
          ))
        )}
      </div>

      <Can permission="ticket.comment.add">
        <div className="card-surface p-md">
          <textarea
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Escreva um comentário…"
            className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim"
          />
          <div className="mt-sm flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              Comentário interno
            </label>
            <Button size="sm" disabled={!text.trim() || add.isPending} loading={add.isPending} onClick={() => add.mutate()}>
              <Send className="h-3.5 w-3.5" /> Comentar
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}
