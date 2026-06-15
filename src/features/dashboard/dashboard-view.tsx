'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ticket, CheckCircle2, ShieldCheck, Timer, RefreshCw, BookOpen } from 'lucide-react';
import { analyticsApi } from '@/shared/api/endpoints';
import { Select } from '@/shared/ui/select';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

const pct = (n: number) => `${Math.round((n ?? 0) * 100)}%`;
const hours = (n: number) => `${(n ?? 0).toFixed(1)}h`;

/** Dashboard operacional (F9): KPIs + distribuições + equipes, a partir de /analytics/dashboard. */
export function DashboardView() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'dashboard', days],
    queryFn: () => analyticsApi.dashboard(days),
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <h1 className="text-lg font-bold">Dashboard</h1>
        <div className="ml-auto flex items-center gap-sm">
          <div className="w-40">
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: 'Últimos 7 dias' },
                { value: 30, label: 'Últimos 30 dias' },
                { value: 90, label: 'Últimos 90 dias' },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted hover:text-text"
            aria-label="Atualizar"
          >
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {isLoading ? (
          <LoadingState label="Carregando indicadores…" />
        ) : isError || !data ? (
          <ErrorState title="Não foi possível carregar o dashboard" onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : (
          <div className="flex flex-col gap-lg">
            {/* KPIs */}
            <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
              <Kpi icon={Ticket} label="Tickets no período" value={String(data.kpis.totalTickets)} />
              <Kpi icon={CheckCircle2} label="Resolvidos" value={String(data.kpis.resolvedTickets)} accent="success" />
              <Kpi icon={ShieldCheck} label="SLA cumprido" value={pct(data.kpis.slaComplianceRate)} accent={data.kpis.slaComplianceRate >= 0.9 ? 'success' : 'warning'} />
              <Kpi icon={Timer} label="MTTR" value={hours(data.kpis.mttrHours)} />
            </div>

            {/* Distribuições */}
            <div className="grid gap-lg lg:grid-cols-3">
              <Distribution title="Por status" data={data.ticketsByStatus} />
              <Distribution title="Por prioridade" data={data.ticketsByPriority} />
              <Distribution title="Causas raiz por categoria" data={data.rootCausesByCategory} />
            </div>

            {/* Equipes */}
            <div>
              <p className="mb-sm text-sm font-semibold">Equipes</p>
              {data.teams.length === 0 ? (
                <p className="text-sm text-dim">Sem dados de equipe no período.</p>
              ) : (
                <div className="card-surface overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-dim">
                        <th className="px-md py-2 font-semibold">Equipe</th>
                        <th className="px-md py-2 font-semibold">Tickets</th>
                        <th className="px-md py-2 font-semibold">Resolvidos</th>
                        <th className="px-md py-2 font-semibold">SLA</th>
                        <th className="px-md py-2 font-semibold">MTTR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.teams.map((tm) => (
                        <tr key={tm.teamId} className="border-t border-border/60">
                          <td className="px-md py-2 font-medium">{tm.teamName}</td>
                          <td className="px-md py-2 text-muted">{tm.totalTickets}</td>
                          <td className="px-md py-2 text-muted">{tm.resolvedTickets}</td>
                          <td className="px-md py-2 text-muted">{pct(tm.slaComplianceRate)}</td>
                          <td className="px-md py-2 text-muted">{hours(tm.avgMttrHours)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Base de conhecimento */}
            <div className="card-surface flex flex-wrap items-center gap-lg p-lg">
              <BookOpen className="h-6 w-6 text-primary" aria-hidden />
              <Mini label="Ativos" value={String(data.knowledgeBase.totalAssets)} />
              <Mini label="Publicados" value={String(data.knowledgeBase.publishedAssets)} />
              <Mini label="Usados em resoluções" value={String(data.knowledgeBase.assetsUsedInResolutions)} />
              <Mini label="Taxa de reuso" value={pct(data.knowledgeBase.reuseRate)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Ticket;
  label: string;
  value: string;
  accent?: 'success' | 'warning';
}) {
  return (
    <div className="card-surface p-lg">
      <div className="flex items-center gap-sm text-dim">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('mt-2 text-2xl font-bold', accent === 'success' && 'text-success', accent === 'warning' && 'text-warning')}>
        {value}
      </p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-dim">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

function Distribution({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data ?? {}).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="card-surface p-lg">
      <p className="mb-md text-sm font-semibold">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-dim">Sem dados.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {entries.map(([k, v]) => (
            <div key={k}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="truncate text-muted">{k}</span>
                <span className="font-semibold">{v}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-panel-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
