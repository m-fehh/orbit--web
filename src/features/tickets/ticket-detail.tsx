'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { toast } from 'sonner';
import { MessageSquare, Clock, Info, Send, Lock, ShieldAlert, Timer } from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import { TicketStatus, type TicketStatusValue, type SlaSnapshotResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { PriorityBadge, StatusBadge, STATUS_LABEL } from './badges';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

type SubTab = 'overview' | 'conversation' | 'worklogs';

const SLA_STYLE: Record<SlaSnapshotResponse['status'], string> = {
  OnTrack: 'text-success',
  AtRisk: 'text-warning',
  Breached: 'text-danger',
  None: 'text-dim',
};

/** Workspace do ticket: header com ações + abas internas. */
export function TicketDetail({ id }: { id: number }) {
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>('overview');

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketsApi.get(id),
  });
  const { data: sla } = useQuery({
    queryKey: ['tickets', 'sla', id],
    queryFn: () => ticketsApi.getSla(id),
    enabled: !!ticket,
  });

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatusValue) => ticketsApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: () => toast.error('Não foi possível mudar o status'),
  });

  if (isLoading) return <LoadingState label="Carregando ticket…" />;
  if (isError || !ticket)
    return <ErrorState title="Erro ao carregar o ticket" onRetry={() => refetch()} retryLabel="Tentar de novo" />;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 p-lg">
        <div className="flex flex-wrap items-start gap-md">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-sm">
              <span className="font-mono text-sm font-bold text-primary">{ticket.number}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
            </div>
            <h1 className="mt-1 truncate text-xl font-bold">{ticket.title}</h1>
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            Status
            <select
              value={TicketStatus[ticket.status]}
              onChange={(e) => changeStatus.mutate(Number(e.target.value) as TicketStatusValue)}
              disabled={changeStatus.isPending}
              className="rounded border border-border bg-bg-subtle px-md py-2 text-sm text-text outline-none focus:border-primary"
            >
              {Object.entries(TicketStatus).map(([name, value]) => (
                <option key={name} value={value}>
                  {STATUS_LABEL[name as keyof typeof STATUS_LABEL]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Sub-abas */}
        <div className="mt-md flex gap-1">
          <SubTabBtn active={sub === 'overview'} onClick={() => setSub('overview')} icon={<Info className="h-4 w-4" />}>
            Visão geral
          </SubTabBtn>
          <SubTabBtn active={sub === 'conversation'} onClick={() => setSub('conversation')} icon={<MessageSquare className="h-4 w-4" />}>
            Conversa ({ticket.comments.length})
          </SubTabBtn>
          <SubTabBtn active={sub === 'worklogs'} onClick={() => setSub('worklogs')} icon={<Clock className="h-4 w-4" />}>
            Worklogs ({ticket.worklogs.length})
          </SubTabBtn>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {sub === 'overview' && (
          <div className="grid gap-md md:grid-cols-2">
            <Field label="Descrição" full>
              <p className="whitespace-pre-wrap text-sm text-text">{ticket.description || '—'}</p>
            </Field>
            <Field label="Cliente">#{ticket.customerId}</Field>
            <Field label="Responsável">{ticket.assignedUserId ? `#${ticket.assignedUserId}` : '—'}</Field>
            <Field label="Equipe">{ticket.assignedTeamId ? `#${ticket.assignedTeamId}` : '—'}</Field>
            <Field label="Aberto em">{formatDateTime(ticket.openedAt, { locale, timeZone })}</Field>
            <Field label="SLA">
              {sla ? (
                <span className={cn('inline-flex items-center gap-1.5 font-medium', SLA_STYLE[sla.status])}>
                  {sla.status === 'Breached' ? <ShieldAlert className="h-4 w-4" /> : <Timer className="h-4 w-4" />}
                  {sla.status}
                  {sla.dueAt && <span className="text-dim">· vence {formatDateTime(sla.dueAt, { locale, timeZone })}</span>}
                </span>
              ) : (
                '—'
              )}
            </Field>
          </div>
        )}

        {sub === 'conversation' && <Conversation ticketId={id} comments={ticket.comments} locale={locale} timeZone={timeZone} />}

        {sub === 'worklogs' && (
          <div className="flex flex-col gap-sm">
            {ticket.worklogs.length === 0 ? (
              <p className="text-sm text-dim">Nenhum worklog registrado.</p>
            ) : (
              ticket.worklogs.map((w) => (
                <div key={w.id} className="card-surface flex items-center justify-between p-md">
                  <div>
                    <p className="text-sm font-medium">{w.type}</p>
                    <p className="text-xs text-muted">{w.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{w.durationMinutes} min</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SubTabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-md py-1.5 text-sm transition-colors',
        active ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={cn('card-surface p-md', full && 'md:col-span-2')}>
      <p className="mb-1 text-xs uppercase tracking-wide text-dim">{label}</p>
      <div className="text-sm text-text">{children}</div>
    </div>
  );
}

function Conversation({
  ticketId,
  comments,
  locale,
  timeZone,
}: {
  ticketId: number;
  comments: { id: number; userId: number; message: string; isInternal: boolean; createdAt: string | null }[];
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
    onError: () => toast.error('Não foi possível comentar'),
  });

  return (
    <div className="flex h-full flex-col gap-md">
      <div className="flex flex-1 flex-col gap-sm">
        {comments.length === 0 ? (
          <p className="text-sm text-dim">Sem comentários ainda.</p>
        ) : (
          comments.map((c) => (
            <div
              key={c.id}
              className={cn(
                'card-surface p-md',
                c.isInternal && 'border-warning/40 bg-warning/5',
              )}
            >
              <div className="mb-1 flex items-center gap-sm text-xs text-muted">
                <span className="font-medium text-text">Usuário #{c.userId}</span>
                {c.isInternal && (
                  <span className="inline-flex items-center gap-1 text-warning">
                    <Lock className="h-3 w-3" /> interno
                  </span>
                )}
                {c.createdAt && <span className="text-dim">{formatDateTime(c.createdAt, { locale, timeZone })}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.message}</p>
            </div>
          ))
        )}
      </div>

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
    </div>
  );
}
