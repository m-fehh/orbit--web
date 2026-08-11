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
  ArrowUpRight,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { analyticsApi, intelligenceApi, satisfactionApi } from '@/shared/api/endpoints';
import type { SatisfactionSummaryResponse } from '@/shared/api/types';
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
import { useTabStore, type TabLocation } from '@/features/workspace/tab-store';
import { usePermissions } from '@/features/auth/use-permissions';

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
  const openTab = useTabStore((s) => s.openTab);
  const { can } = usePermissions();

  // Drill-down: cada widget leva à view canônica que a API já alimenta. O dashboard vira um
  // launchpad. Só fica clicável se o usuário tem a permissão da view-destino (senão `undefined`,
  // e o widget renderiza inerte). Não abre a Central de Tickets (gated por iteração) de propósito.
  const go = (loc: TabLocation, perm?: string) =>
    !perm || can(perm) ? () => openTab(loc) : undefined;

  const toReliability = go({ kind: 'reliability', params: {}, title: 'Confiabilidade', icon: 'analytics' }, 'intelligence.view');
  const toProblems = go({ kind: 'problems', params: {}, title: 'Radar de Recorrência', icon: 'analytics' }, 'intelligence.view');
  const toKnowledge = go({ kind: 'knowledge', params: {}, title: 'Base de Conhecimento', icon: 'knowledge' }, 'knowledge.view');
  const toIterations = go({ kind: 'iterations', params: {}, title: 'Iterações', icon: 'tickets' }, 'ticket.view');
  const toIntelligence = go({ kind: 'intelligence', params: {}, title: 'Intelligence', icon: 'analytics' }, 'intelligence.view');
  const openLabel = t('openView');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['analytics', 'dashboard', days],
    queryFn: () => analyticsApi.dashboard(days),
  });
  const overview = useQuery({
    queryKey: ['intelligence', 'overview', days],
    queryFn: () => intelligenceApi.overview(days),
  });
  const csat = useQuery({
    queryKey: ['satisfaction', 'summary', days],
    queryFn: () => satisfactionApi.summary(days),
    enabled: can('satisfaction.view'),
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
                onOpen={toIterations}
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
                onOpen={toIterations}
              />
              <Kpi
                icon={ShieldCheck}
                label={t('slaCompliance')}
                value={formatPct(data.kpis.slaComplianceRate)}
                sub={t('slaBreaches', { count: data.kpis.slaBreaches })}
                accentColor={healthColor(data.kpis.slaComplianceRate)}
                valueClass={healthTextClass(data.kpis.slaComplianceRate)}
                delay={0.1}
                onOpen={toReliability}
              />
              <Kpi
                icon={Timer}
                label={t('mttr')}
                value={formatHours(data.kpis.mttrHours)}
                sub={t('mttaValue', { value: formatHours(data.kpis.mttaHours) })}
                delay={0.15}
                onOpen={toReliability}
              />
            </div>

            {/* Tendência abertos × resolvidos */}
            <ChartCard
              title={t('trendTitle')}
              icon={<TrendingUp className="h-4 w-4 text-primary" />}
              action={<OpenBtn onClick={toIterations} label={openLabel} />}
            >
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
              <ChartCard title={t('byStatus')} action={<OpenBtn onClick={toIterations} label={openLabel} />}>
                <StatusBars data={data.ticketsByStatus} emptyLabel={t('noData')} />
              </ChartCard>
              <ChartCard title={t('byRootCause')} action={<OpenBtn onClick={toProblems} label={openLabel} />}>
                {rootCauseSlices.length === 0 ? (
                  <EmptyHint text={t('noRootCauseData')} />
                ) : (
                  <DonutChart slices={rootCauseSlices} centerLabel={t('causes')} />
                )}
              </ChartCard>
            </div>

            {/* Satisfação do cliente (CSAT) */}
            {can('satisfaction.view') && <SatisfactionBlock summary={csat.data} loading={csat.isLoading} />}

            {/* Bloco Inteligência */}
            <IntelligenceBlock t={t} overview={overview.data} loading={overview.isLoading} onOpen={toIntelligence} openLabel={openLabel} />

            {/* Base de conhecimento */}
            <ChartCard
              title={t('knowledgeTitle')}
              icon={<BookOpen className="h-4 w-4 text-primary" />}
              action={<OpenBtn onClick={toKnowledge} label={openLabel} />}
            >
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
  onOpen,
  openLabel,
}: {
  t: ReturnType<typeof useTranslations>;
  overview: import('@/shared/api/types').IntelligenceOverview | undefined;
  loading: boolean;
  onOpen?: () => void;
  openLabel: string;
}) {
  const coverage =
    overview && overview.playbooksTotal > 0 ? overview.playbooksPublished / overview.playbooksTotal : 0;
  return (
    <ChartCard
      title={t('intelligenceTitle')}
      icon={<Brain className="h-4 w-4 text-primary" />}
      action={
        <div className="flex items-center gap-2">
          {overview ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-semibold text-primary">
              {t('lastNdays', { days: overview.days })}
            </span>
          ) : null}
          <OpenBtn onClick={onOpen} label={openLabel} />
        </div>
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

function SatisfactionBlock({ summary, loading }: { summary: SatisfactionSummaryResponse | undefined; loading: boolean }) {
  const t = useTranslations('satisfaction');
  const dist = summary?.distribution ?? [0, 0, 0, 0, 0];
  const max = Math.max(1, ...dist);
  const rounded = Math.round(summary?.average ?? 0);
  return (
    <ChartCard title={t('cardTitle')} icon={<Star className="h-4 w-4 text-primary" />}>
      {loading ? (
        <LoadingState />
      ) : !summary || summary.responses === 0 ? (
        <EmptyHint text={t('noData')} />
      ) : (
        <div className="grid gap-lg sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex flex-col items-center gap-1 sm:pr-lg">
            <span className="text-3xl font-bold text-text">{summary.average.toFixed(1)}</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn('h-4 w-4', n <= rounded ? 'text-warning' : 'text-dim')}
                  style={{ fill: n <= rounded ? 'currentColor' : 'none' }}
                  aria-hidden
                />
              ))}
            </div>
            <span className="text-xs text-muted">{t('responses', { count: summary.responses })}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const c = dist[star - 1] ?? 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-dim">{star}</span>
                  <Star className="h-3 w-3 text-warning" style={{ fill: 'currentColor' }} aria-hidden />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-warning" style={{ width: `${(c / max) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right tabular-nums text-muted">{c}</span>
                </div>
              );
            })}
          </div>
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
  onOpen,
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
  onOpen?: () => void;
}) {
  const clickable = !!onOpen;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={cn(
        'card-surface group relative overflow-hidden p-lg outline-none',
        clickable &&
          'cursor-pointer transition-shadow hover:ring-1 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/60',
      )}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen!();
              }
            }
          : undefined
      }
    >
      {accentColor && (
        <span className="absolute inset-y-0 left-0 w-1 rounded-r" style={{ backgroundColor: accentColor }} />
      )}
      {clickable && (
        <ArrowUpRight
          className="absolute right-3 top-3 h-3.5 w-3.5 text-dim opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
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

/** Atalho discreto ("abrir view") no canto de um card. Inerte (nada renderiza) sem permissão/destino. */
function OpenBtn({ onClick, label }: { onClick?: () => void; label: string }) {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-6 w-6 place-items-center rounded-md text-dim transition-colors hover:bg-bg-subtle hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60 outline-none"
    >
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
    </button>
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
