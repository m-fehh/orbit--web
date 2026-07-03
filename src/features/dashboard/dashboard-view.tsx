'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import {
  Ticket,
  CheckCircle2,
  ShieldCheck,
  Timer,
  RefreshCw,
  BookOpen,
  Brain,
  Sparkles,
  Zap,
  Target,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { analyticsApi, intelligenceApi } from '@/shared/api/endpoints';
import { Select } from '@/shared/ui/select';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import {
  ChartCard,
  DonutChart,
  HBarChart,
  LineChart,
  ProgressBar,
  Sparkline,
  SERIES_PALETTE,
  formatHours,
  formatPct,
  formatShortDate,
  healthColor,
  healthTextClass,
} from '@/shared/ui/charts';
import { cn } from '@/shared/lib/utils';

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

/** Dashboard executivo: KPIs com saúde semântica + tendência + bloco de inteligência. */
export function DashboardView() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'dashboard', days],
    queryFn: () => analyticsApi.dashboard(days),
  });
  const overview = useQuery({
    queryKey: ['intelligence', 'overview', days],
    queryFn: () => intelligenceApi.overview(days),
  });

  const trend = data?.trend ?? [];
  const openedSpark = useMemo(() => trend.map((p) => p.opened), [trend]);
  const closedSpark = useMemo(() => trend.map((p) => p.closed), [trend]);

  const rc = data?.rootCausesByCategory ?? {};
  const rootCauseSlices = useMemo(
    () =>
      Object.entries(rc)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, value], i) => ({ label, value, color: SERIES_PALETTE[i % SERIES_PALETTE.length] })),
    [rc],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-sm">
          <div className="w-40">
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: t('last7days') },
                { value: 30, label: t('last30days') },
                { value: 90, label: t('last90days') },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={() => { refetch(); overview.refetch(); }}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted transition-colors hover:text-text"
            aria-label={t('refresh')}
          >
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {isLoading ? (
          <LoadingState label={t('loading')} />
        ) : isError || !data ? (
          <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />
        ) : (
          <div className="mx-auto flex max-w-[1400px] flex-col gap-lg">
            {/* KPIs com saúde semântica + sparkline */}
            <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
              <Kpi
                icon={Ticket}
                label={t('ticketsInPeriod')}
                value={String(data.kpis.totalTickets)}
                spark={openedSpark}
                sparkColor="var(--orbit-color-primary)"
                delay={0}
              />
              <Kpi
                icon={CheckCircle2}
                label={t('resolved')}
                value={String(data.kpis.resolvedTickets)}
                sub={t('resolutionRateValue', { value: formatPct(data.kpis.resolutionRate) })}
                spark={closedSpark}
                sparkColor="var(--orbit-color-success)"
                accentColor="var(--orbit-color-success)"
                delay={0.05}
              />
              <Kpi
                icon={ShieldCheck}
                label={t('slaCompliance')}
                value={formatPct(data.kpis.slaComplianceRate)}
                sub={t('slaBreaches', { count: data.kpis.slaBreaches })}
                accentColor={healthColor(data.kpis.slaComplianceRate)}
                valueClass={healthTextClass(data.kpis.slaComplianceRate)}
                delay={0.1}
              />
              <Kpi
                icon={Timer}
                label={t('mttr')}
                value={formatHours(data.kpis.mttrHours)}
                sub={t('mttaValue', { value: formatHours(data.kpis.mttaHours) })}
                delay={0.15}
              />
            </div>

            {/* Tendência abertos × resolvidos */}
            <ChartCard title={t('trendTitle')} icon={<TrendingUp className="h-4 w-4 text-primary" />}>
              {trend.length < 2 ? (
                <EmptyHint text={t('noTrendData')} />
              ) : (
                <LineChart
                  labels={trend.map((p) => formatShortDate(p.date, locale))}
                  series={[
                    { key: 'opened', label: t('opened'), color: 'var(--orbit-color-primary)', values: openedSpark },
                    { key: 'closed', label: t('closed'), color: 'var(--orbit-color-success)', values: closedSpark },
                  ]}
                />
              )}
            </ChartCard>

            {/* Grid: distribuição status + causas raiz */}
            <div className="grid gap-lg lg:grid-cols-2">
              <ChartCard title={t('byStatus')}>
                <StatusBars data={data.ticketsByStatus} emptyLabel={t('noData')} />
              </ChartCard>
              <ChartCard title={t('byRootCause')}>
                {rootCauseSlices.length === 0 ? (
                  <EmptyHint text={t('noRootCauseData')} />
                ) : (
                  <DonutChart slices={rootCauseSlices} centerLabel={t('causes')} />
                )}
              </ChartCard>
            </div>

            {/* Bloco Inteligência */}
            <IntelligenceBlock t={t} overview={overview.data} loading={overview.isLoading} />

            {/* Base de conhecimento */}
            <ChartCard title={t('knowledgeTitle')} icon={<BookOpen className="h-4 w-4 text-primary" />}>
              <div className="grid grid-cols-2 gap-lg sm:grid-cols-4">
                <Mini label={t('knowledgeAssets')} value={String(data.knowledgeBase.totalAssets)} />
                <Mini label={t('knowledgePublished')} value={String(data.knowledgeBase.publishedAssets)} />
                <Mini label={t('knowledgeUsedInResolutions')} value={String(data.knowledgeBase.assetsUsedInResolutions)} />
                <Mini label={t('knowledgeReuseRate')} value={formatPct(data.knowledgeBase.reuseRate)} />
              </div>
            </ChartCard>
          </div>
        )}
      </div>
    </div>
  );
}

function IntelligenceBlock({
  t,
  overview,
  loading,
}: {
  t: ReturnType<typeof useTranslations>;
  overview: import('@/shared/api/types').IntelligenceOverview | undefined;
  loading: boolean;
}) {
  const coverage =
    overview && overview.playbooksTotal > 0 ? overview.playbooksPublished / overview.playbooksTotal : 0;
  return (
    <ChartCard
      title={t('intelligenceTitle')}
      icon={<Brain className="h-4 w-4 text-primary" />}
      action={
        overview ? (
          <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
            {t('lastNdays', { days: overview.days })}
          </span>
        ) : null
      }
    >
      {loading ? (
        <LoadingState />
      ) : !overview ? (
        <EmptyHint text={t('noIntelligence')} />
      ) : (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <IntelMetric
            icon={BookOpen}
            label={t('playbookCoverage')}
            value={formatPct(coverage)}
            hint={t('playbookCoverageHint', { published: overview.playbooksPublished, total: overview.playbooksTotal })}
            progress={coverage}
            color="var(--orbit-color-primary)"
          />
          <IntelMetric
            icon={Sparkles}
            label={t('acceptanceRate')}
            value={formatPct(overview.acceptanceRate)}
            hint={t('helpfulRateHint', { value: formatPct(overview.helpfulRate) })}
            progress={overview.acceptanceRate}
            color={healthColor(overview.acceptanceRate, 0.6, 0.4)}
          />
          <IntelMetric
            icon={Target}
            label={t('topRootCause')}
            value={overview.rootCauseDistribution[0]?.category ?? '—'}
            hint={
              overview.rootCauseDistribution[0]
                ? t('occurrences', { count: overview.rootCauseDistribution[0].count })
                : t('noData')
            }
          />
          <IntelMetric
            icon={Zap}
            label={t('automationOpportunities')}
            value={String(overview.automationOpportunityCount)}
            hint={t('automationHint')}
            color="var(--orbit-color-warning)"
          />
        </div>
      )}
    </ChartCard>
  );
}

function IntelMetric({
  icon: Icon,
  label,
  value,
  hint,
  progress,
  color = 'var(--orbit-color-primary)',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-panel-2/40 p-md">
      <div className="flex items-center gap-2 text-dim">
        <Icon className="h-3.5 w-3.5" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 truncate text-xl font-bold text-text" title={value}>
        {value}
      </p>
      {typeof progress === 'number' && <ProgressBar value={progress} color={color} className="mt-2" />}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  sub,
  spark,
  sparkColor,
  accentColor,
  valueClass,
  delay = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  spark?: number[];
  sparkColor?: string;
  accentColor?: string;
  valueClass?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="card-surface relative overflow-hidden p-lg"
    >
      {accentColor && (
        <span className="absolute inset-y-0 left-0 w-1 rounded-r" style={{ backgroundColor: accentColor }} />
      )}
      <div className="flex items-center gap-sm text-dim">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className={cn('text-2xl font-bold', valueClass)}>{value}</p>
        {spark && spark.length >= 2 && <Sparkline data={spark} color={sparkColor} />}
      </div>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </motion.div>
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

function StatusBars({ data, emptyLabel }: { data: Record<string, number>; emptyLabel: string }) {
  const items = Object.entries(data ?? {})
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value, color: STATUS_COLORS[label] ?? 'var(--orbit-color-muted)' }));
  if (items.length === 0) return <EmptyHint text={emptyLabel} />;
  return <HBarChart items={items} />;
}

function EmptyHint({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-dim">{text}</p>;
}
