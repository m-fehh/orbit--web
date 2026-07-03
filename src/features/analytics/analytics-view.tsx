'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Target,
  RotateCcw,
  AlertTriangle,
  Users,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { analyticsApi } from '@/shared/api/endpoints';
import type { TeamMetrics } from '@/shared/api/types';
import {
  ChartCard,
  DonutChart,
  HBarChart,
  LineChart,
  ProgressBar,
  formatHours,
  formatMinutes,
  formatPct,
  formatShortDate,
  healthColor,
  healthTextClass,
  SERIES_PALETTE,
} from '@/shared/ui/charts';

type PeriodDays = 30 | 90 | 180;
type Granularity = 'Daily' | 'Weekly' | 'Monthly';

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'var(--orbit-color-success)',
  Medium: 'var(--orbit-color-warning)',
  High: '#f97316',
  Critical: 'var(--orbit-color-danger)',
};

const STATUS_COLORS: Record<string, string> = {
  New: 'var(--orbit-color-info)',
  Assigned: '#8b5cf6',
  InProgress: 'var(--orbit-color-primary)',
  PendingCustomer: 'var(--orbit-color-warning)',
  PendingInternal: '#f97316',
  Resolved: 'var(--orbit-color-success)',
  Validated: 'var(--orbit-color-success)',
  Closed: 'var(--orbit-color-dim)',
  Cancelled: 'var(--orbit-color-dim)',
};

export function AnalyticsView() {
  const t = useTranslations('analytics');
  const locale = useLocale();
  const [days, setDays] = useState<PeriodDays>(30);
  const [granularity, setGranularity] = useState<Granularity>('Daily');

  const { data: dashboard, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analytics-dashboard', days],
    queryFn: () => analyticsApi.dashboard(days),
    staleTime: 60_000,
  });
  const { data: trendData } = useQuery({
    queryKey: ['analytics-trends', days, granularity],
    queryFn: () => analyticsApi.trends(days, granularity),
    staleTime: 60_000,
  });
  const { data: slaData } = useQuery({
    queryKey: ['analytics-sla', days],
    queryFn: () => analyticsApi.slaCompliance(days),
    staleTime: 60_000,
  });

  const kpis = dashboard?.kpis;
  const trend = trendData ?? dashboard?.trend ?? [];
  const teams = dashboard?.teams ?? [];
  const violations = slaData?.violations ?? [];

  const priorityItems = useMemo(
    () =>
      Object.entries(dashboard?.ticketsByPriority ?? {}).map(([label, value]) => ({
        label,
        value,
        color: PRIORITY_COLORS[label] ?? 'var(--orbit-color-muted)',
      })),
    [dashboard],
  );
  const statusItems = useMemo(
    () =>
      Object.entries(dashboard?.ticketsByStatus ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? 'var(--orbit-color-muted)' })),
    [dashboard],
  );
  const rootCauseSlices = useMemo(
    () =>
      Object.entries(dashboard?.rootCausesByCategory ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], i) => ({ label, value, color: SERIES_PALETTE[i % SERIES_PALETTE.length] })),
    [dashboard],
  );

  const maxTeamTickets = Math.max(1, ...teams.map((tm) => tm.totalTickets));

  if (isError) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted">
        <AlertTriangle size={32} />
        <p>{t('error')}</p>
        <button onClick={() => refetch()} className="btn-primary rounded-md px-4 py-2 text-sm">
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-sm">
          <div className="flex overflow-hidden rounded-md border border-border text-sm">
            {([30, 90, 180] as PeriodDays[]).map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={cn(
                  'px-3 py-1.5 transition-colors',
                  days === d ? 'btn-primary' : 'bg-panel text-text hover:bg-panel-2',
                )}
              >
                {t('daysShort', { days: d })}
              </button>
            ))}
          </div>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            className="rounded-md border border-border bg-panel px-2 py-1.5 text-sm text-text"
            aria-label={t('granularity')}
          >
            <option value="Daily">{t('daily')}</option>
            <option value="Weekly">{t('weekly')}</option>
            <option value="Monthly">{t('monthly')}</option>
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted transition-colors hover:text-text disabled:opacity-50"
            aria-label={t('retry')}
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-lg">
          {/* KPIs */}
          {isLoading ? (
            <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border border-border bg-panel" />
              ))}
            </div>
          ) : kpis ? (
            <div className="grid grid-cols-2 gap-md lg:grid-cols-3">
              <KpiCard icon={<BarChart3 size={14} />} label={t('totalTickets')} value={String(kpis.totalTickets)} delay={0} />
              <KpiCard
                icon={<CheckCircle2 size={14} />}
                label={t('resolved')}
                value={String(kpis.resolvedTickets)}
                subtitle={t('resolutionRateValue', { value: formatPct(kpis.resolutionRate) })}
                delay={0.05}
              />
              <KpiCard icon={<Clock size={14} />} label={t('mttr')} value={formatHours(kpis.mttrHours)} subtitle={t('mttrSubtitle')} delay={0.1} />
              <KpiCard
                icon={<ShieldCheck size={14} />}
                label={t('slaCompliance')}
                value={formatPct(kpis.slaComplianceRate)}
                accentColor={healthColor(kpis.slaComplianceRate)}
                valueClass={healthTextClass(kpis.slaComplianceRate)}
                delay={0.15}
              />
              <KpiCard icon={<Target size={14} />} label={t('resolutionRate')} value={formatPct(kpis.resolutionRate)} delay={0.2} />
              <KpiCard
                icon={<RotateCcw size={14} />}
                label={t('recurrenceRate')}
                value={formatPct(kpis.recurrenceRate)}
                valueClass={kpis.recurrenceRate > 0.2 ? 'text-warning' : undefined}
                delay={0.25}
              />
            </div>
          ) : null}

          {/* Tendência */}
          <ChartCard title={t('trendTitle')} icon={<TrendingUp className="h-4 w-4 text-primary" />}>
            {trend.length < 2 ? (
              <p className="py-8 text-center text-sm text-dim">{t('noData')}</p>
            ) : (
              <LineChart
                labels={trend.map((p) => formatShortDate(p.date, locale))}
                series={[
                  { key: 'opened', label: t('opened'), color: 'var(--orbit-color-primary)', values: trend.map((p) => p.opened) },
                  { key: 'closed', label: t('closed'), color: 'var(--orbit-color-success)', values: trend.map((p) => p.closed) },
                ]}
              />
            )}
          </ChartCard>

          {/* Distribuições */}
          <div className="grid grid-cols-1 gap-lg md:grid-cols-3">
            <ChartCard title={t('byPriority')}>
              {priorityItems.length ? <HBarChart items={priorityItems} /> : <p className="text-xs text-dim">{t('noData')}</p>}
            </ChartCard>
            <ChartCard title={t('byStatus')}>
              {statusItems.length ? <HBarChart items={statusItems} /> : <p className="text-xs text-dim">{t('noData')}</p>}
            </ChartCard>
            <ChartCard title={t('byRootCause')}>
              {rootCauseSlices.length ? (
                <DonutChart slices={rootCauseSlices} size={140} centerLabel={t('total')} />
              ) : (
                <p className="text-xs text-dim">{t('noData')}</p>
              )}
            </ChartCard>
          </div>

          {/* Conformidade SLA */}
          <ChartCard
            title={t('slaCompliance')}
            icon={<ShieldCheck className="h-4 w-4 text-primary" />}
            action={
              slaData ? (
                <span className={cn('text-sm font-bold', healthTextClass(slaData.complianceRate))}>
                  {formatPct(slaData.complianceRate)}
                </span>
              ) : null
            }
          >
            {slaData ? (
              <div className="flex flex-col gap-md">
                <ProgressBar value={slaData.complianceRate} color={healthColor(slaData.complianceRate)} className="h-2" />
                <div className="flex flex-wrap gap-lg text-sm">
                  <span className="text-muted">{t('slaEvaluated', { count: slaData.totalEvaluated })}</span>
                  <span className={slaData.breached > 0 ? 'font-medium text-danger' : 'text-muted'}>
                    {t('slaBreached', { count: slaData.breached })}
                  </span>
                </div>

                <div className="mt-1">
                  <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
                    <AlertTriangle size={14} className="text-warning" />
                    {t('slaViolationsTitle')}
                  </p>
                  {violations.length === 0 ? (
                    <p className="text-xs text-dim">{t('noViolations')}</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-dim">
                            <th className="px-3 py-2 font-semibold">{t('ticketNumber')}</th>
                            <th className="px-3 py-2 font-semibold">{t('priority')}</th>
                            <th className="px-3 py-2 text-right font-semibold">{t('minutesOverdue')}</th>
                            <th className="px-3 py-2 font-semibold">{t('dueAt')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {violations.slice(0, 12).map((v) => (
                            <tr key={v.ticketId} className="border-t border-border/60">
                              <td className="px-3 py-2 font-medium">{v.ticketNumber}</td>
                              <td className="px-3 py-2">
                                <span
                                  className="inline-flex items-center gap-1.5 text-muted"
                                  style={{ color: PRIORITY_COLORS[v.priority] }}
                                >
                                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[v.priority] ?? 'var(--orbit-color-muted)' }} />
                                  {v.priority}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-danger tabular-nums">
                                {formatMinutes(v.minutesOverdue)}
                              </td>
                              <td className="px-3 py-2 text-muted">{new Date(v.dueAt).toLocaleString(locale)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-dim">{t('noData')}</p>
            )}
          </ChartCard>

          {/* Métricas por equipe */}
          <ChartCard title={t('teamsTitle')} icon={<Users className="h-4 w-4 text-primary" />}>
            {teams.length === 0 ? (
              <p className="py-6 text-center text-sm text-dim">{t('noTeamData')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-dim">
                      <th className="px-3 py-2 font-semibold">{t('teamName')}</th>
                      <th className="px-3 py-2 font-semibold">{t('totalTickets')}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t('resolutionRate')}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t('avgMttr')}</th>
                      <th className="px-3 py-2 text-right font-semibold">{t('slaCompliance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teams.map((tm: TeamMetrics) => (
                      <tr key={tm.teamId} className="border-t border-border/60">
                        <td className="px-3 py-2 font-medium">{tm.teamName}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="w-8 tabular-nums text-muted">{tm.totalTickets}</span>
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-panel-2">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${(tm.totalTickets / maxTeamTickets) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{formatPct(tm.resolutionRate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted">{formatHours(tm.avgMttrHours)}</td>
                        <td className={cn('px-3 py-2 text-right font-semibold tabular-nums', healthTextClass(tm.slaComplianceRate))}>
                          {formatPct(tm.slaComplianceRate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  subtitle,
  accentColor,
  valueClass,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  accentColor?: string;
  valueClass?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="card-surface relative flex flex-col gap-1 overflow-hidden p-lg"
    >
      {accentColor && <span className="absolute inset-y-0 left-0 w-1 rounded-r" style={{ backgroundColor: accentColor }} />}
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-dim">
        {icon}
        {label}
      </div>
      <div className={cn('text-2xl font-bold text-text', valueClass)}>{value}</div>
      {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
    </motion.div>
  );
}
