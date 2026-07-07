'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Radar as RadarLucide, Sparkles, X, ScanSearch, Layers, Wrench, Activity,
} from 'lucide-react';
import { problemsApi, intelligenceApi } from '@/shared/api/endpoints';
import {
  apiErrorMessage, ProblemStatus,
  type ProblemResponse, type ProblemStatusName, type ProblemTicketRef,
} from '@/shared/api/types';
import { useTabStore } from '@/features/workspace/tab-store';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/button';
import { formatShortDate } from '@/shared/ui/charts';
import { SuggestionCard } from '@/features/copilot/copilot-view';
import { cn } from '@/shared/lib/utils';

const STATUS_STYLE: Record<ProblemStatusName, string> = {
  Open: 'bg-danger/15 text-danger',
  Monitoring: 'bg-info/15 text-info',
  Resolved: 'bg-success/15 text-success',
  Dismissed: 'bg-panel-2 text-dim',
};

const STATUS_ORDER: ProblemStatusName[] = ['Open', 'Monitoring', 'Resolved', 'Dismissed'];

function StatusBadge({ status }: { status: ProblemStatusName }) {
  const t = useTranslations('problems');
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLE[status])}>
      {t(`status.${status}` as 'status.Open')}
    </span>
  );
}

/* ---- Detalhe (modal) ---- */

function ProblemDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const t = useTranslations('problems');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const { openTab } = useTabStore();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['problems', id],
    queryFn: () => problemsApi.get(id),
    retry: false,
  });

  const updateStatus = useMutation({
    mutationFn: (status: number) => problemsApi.updateStatus(id, status),
    onSuccess: () => {
      toast.success(t('statusUpdated'));
      qc.invalidateQueries({ queryKey: ['problems'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });

  const escalate = useMutation({
    mutationFn: () => problemsApi.escalate(id),
    onSuccess: () => {
      toast.success(t('escalated'));
      qc.invalidateQueries({ queryKey: ['problems'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });

  const fmtMin = (m: number) => {
    if (!m || m <= 0) return '—';
    const h = Math.floor(m / 60), mm = m % 60;
    return h > 0 ? `${h}h${mm ? ` ${mm}min` : ''}` : `${mm}min`;
  };

  function openTicket(ref: ProblemTicketRef) {
    openTab({
      kind: 'ticket',
      params: { id: ref.id },
      title: `${ref.number} · ${ref.title}`,
      icon: 'ticket',
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <ScanSearch className="h-4 w-4 text-primary" />
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text">
            {data?.title ?? t('detailTitle')}
          </h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />
          ) : data ? (
            <div className="flex flex-col gap-5">
              {/* Cabeçalho de metadados */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={data.status} />
                  {data.category && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{data.category}</span>
                  )}
                  {data.isAutoDetected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                      <Sparkles className="h-2.5 w-2.5" /> {t('autoDetected')}
                    </span>
                  )}
                </div>
                {data.summary && <p className="text-sm text-muted">{data.summary}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-dim">
                  <span>{t('ticketCount', { count: data.ticketCount })}</span>
                  <span>{t('lastSeen')}: {formatShortDate(data.lastSeenAt)}</span>
                  <span>{t('firstSeen')}: {formatShortDate(data.firstSeenAt)}</span>
                </div>
              </div>

              {/* Caso de negócio: impacto acumulado + escalar para engenharia */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-dim">{t('impactLabel')}</p>
                    <p className="text-sm font-bold text-text">
                      {t('ticketCount', { count: data.ticketCount })} · {fmtMin(data.estimatedImpactMinutes)}
                    </p>
                  </div>
                  <div className="ml-auto">
                    {data.escalatedWorkItemId ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-success/15 px-3 py-1.5 text-xs font-semibold text-success">
                        <Wrench className="h-3.5 w-3.5" /> {t('escalated')}
                      </span>
                    ) : (
                      <Button loading={escalate.isPending} onClick={() => escalate.mutate()}>
                        <Wrench className="h-4 w-4" /> {t('escalate')}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-dim">{t('escalateHint')}</p>
              </div>

              {/* Seletor de status */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-text">{t('changeStatus')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_ORDER.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updateStatus.isPending || s === data.status}
                      onClick={() => updateStatus.mutate(ProblemStatus[s])}
                      className={cn(
                        'rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
                        s === data.status
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted hover:border-primary/40 hover:text-text',
                      )}
                    >
                      {t(`status.${s}` as 'status.Open')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tickets afetados */}
              <div className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-text">{t('affectedTickets')}</span>
                {data.tickets.length === 0 ? (
                  <p className="text-xs text-dim">{t('noTickets')}</p>
                ) : (
                  <ul className="divide-y divide-border/40 rounded-lg border border-border">
                    {data.tickets.map((tk) => (
                      <li key={tk.id}>
                        <button
                          type="button"
                          onClick={() => openTicket(tk)}
                          className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-panel-2"
                        >
                          <span className="shrink-0 font-mono text-xs text-primary">{tk.number}</span>
                          <span className="min-w-0 flex-1 truncate text-sm text-text">{tk.title}</span>
                          <span className="shrink-0 text-[11px] text-dim">{formatShortDate(tk.openedAt)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Soluções sugeridas */}
              {data.suggestedSolutions.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-semibold text-text">{t('suggestedSolutions')}</span>
                  <div className="flex flex-col gap-3">
                    {data.suggestedSolutions.map((s) => (
                      <SuggestionCard key={s.playbookId} suggestion={s} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---- Card de problema ---- */

function ProblemCard({ problem, onOpen }: { problem: ProblemResponse; onOpen: () => void }) {
  const t = useTranslations('problems');
  return (
    <button
      type="button"
      onClick={onOpen}
      className="card-surface flex items-start gap-4 p-4 text-left transition-colors hover:border-primary/30"
    >
      {/* Força da recorrência */}
      <div className="flex shrink-0 flex-col items-center rounded-lg bg-primary/10 px-3 py-2">
        <span className="text-xl font-bold text-primary tabular-nums">{problem.ticketCount}</span>
        <span className="text-[9px] font-semibold uppercase tracking-wide text-dim">{t('ticketsShort')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-text">{problem.title}</p>
          <StatusBadge status={problem.status} />
          {problem.category && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{problem.category}</span>
          )}
          {problem.isAutoDetected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
              <Sparkles className="h-2.5 w-2.5" /> {t('autoDetected')}
            </span>
          )}
        </div>
        {problem.summary && <p className="mt-1 text-xs text-muted line-clamp-2">{problem.summary}</p>}
        <p className="mt-1.5 text-[11px] text-dim">{t('lastSeen')}: {formatShortDate(problem.lastSeenAt)}</p>
      </div>
    </button>
  );
}

/* ---- Anomalias de volume (modelo próprio SR-CNN, Orbit.Ai) ---- */

function AnomalyBanner() {
  const t = useTranslations('problems');
  const { data } = useQuery({
    queryKey: ['intelligence', 'anomalies'],
    queryFn: () => intelligenceApi.anomalies(60),
    retry: false,
    staleTime: 300_000,
  });
  if (!data || data.length === 0) return null;
  return (
    <div className="card-surface overflow-hidden border border-warning/25">
      <div className="flex items-center gap-2 bg-gradient-to-r from-warning/10 to-transparent px-4 py-2.5">
        <Activity className="h-4 w-4 text-warning" />
        <p className="text-sm font-bold text-warning">{t('anomaliesTitle')}</p>
        <span className="ml-auto rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{data.length}</span>
      </div>
      <p className="px-4 pt-2 text-xs text-muted">{t('anomaliesHint')}</p>
      <ul className="flex flex-col gap-1.5 p-4">
        {data.map((a, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-panel/60 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm text-text">
              {a.dimension === 'overall' ? t('anomalyOverall') : a.label}
            </span>
            <span className="shrink-0 text-[11px] text-dim">{formatShortDate(a.date)}</span>
            <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold text-warning">
              {t('anomalyCount', { count: a.count })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- View principal ---- */

export function ProblemsView() {
  const t = useTranslations('problems');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<ProblemStatusName | 'All'>('All');
  const [detailId, setDetailId] = useState<number | null>(null);

  const statusNum = statusFilter === 'All' ? undefined : ProblemStatus[statusFilter];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['problems', 'list', statusFilter],
    queryFn: () => problemsApi.list(statusNum),
    retry: false,
  });

  const detect = useMutation({
    mutationFn: () => problemsApi.detect(),
    onSuccess: () => {
      toast.success(t('detectStarted'));
      qc.invalidateQueries({ queryKey: ['problems'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });

  const items = useMemo(() => data ?? [], [data]);

  const FILTERS: (ProblemStatusName | 'All')[] = ['All', ...STATUS_ORDER];

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
          <RadarLucide className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
        <Button className="gap-1.5" onClick={() => detect.mutate()} loading={detect.isPending}>
          <ScanSearch className="h-4 w-4" /> {t('scanNow')}
        </Button>
      </div>

      <AnomalyBanner />

      {/* Filtro por status */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setStatusFilter(f)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === f ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text',
            )}
          >
            {f === 'All' ? t('filterAll') : t(`status.${f}` as 'status.Open')}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />
      ) : items.length === 0 ? (
        <EmptyState icon={Layers} message={t('empty')} />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((p) => (
            <ProblemCard key={p.id} problem={p} onOpen={() => setDetailId(p.id)} />
          ))}
        </div>
      )}

      {detailId != null && <ProblemDetail id={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}
