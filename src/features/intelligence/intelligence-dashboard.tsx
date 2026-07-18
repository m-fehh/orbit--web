'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
  Brain,
  Zap,
  Target,
  BarChart3,
  BookOpen,
  Sparkles,
  ShieldCheck,
  GitBranch,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { intelligenceApi } from '@/shared/api/endpoints';
import { Select } from '@/shared/ui/select';
import { LoadingState } from '@/shared/ui/states';
import {
  ChartCard,
  ParetoChart,
  HBarChart,
  ProgressBar,
  formatMinutes,
  formatPct,
  healthColor,
  healthTextClass,
  SERIES_PALETTE,
} from '@/shared/ui/charts';
import { cn } from '@/shared/lib/utils';

/* ---- Saúde da IA (modelos treinados — Orbit.Ai) ---- */
function AiHealthCard() {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['intelligence', 'ai-health'], queryFn: () => intelligenceApi.aiHealth(), retry: false });
  const train = useMutation({
    mutationFn: () => intelligenceApi.trainModels(),
    onSuccess: (res) => { qc.setQueryData(['intelligence', 'ai-health'], res); toast.success(t('aiTrained')); },
    onError: () => toast.error(t('aiTrainError')),
  });
  const models = data?.models ?? [];
  return (
    <div data-tour="ai-health" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-gradient-to-r from-primary/8 to-transparent px-lg py-3">
        <Brain className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-text">{t('aiHealthTitle')}</p>
        <button
          type="button"
          onClick={() => train.mutate()}
          disabled={train.isPending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', train.isPending && 'animate-spin')} /> {t('aiTrainNow')}
        </button>
      </div>
      <div className="grid gap-px bg-border/60 sm:grid-cols-2">
        {models.map((m) => (
          <div key={m.name} className="flex flex-col gap-1 bg-panel p-md">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-text">{t(`aiModel.${m.name}` as 'aiModel.priority')}</p>
              {m.trained
                ? <span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">{formatPct(m.accuracy)}</span>
                : <span className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{t('aiNotTrained')}</span>}
            </div>
            <p className="text-[11px] text-dim">
              {m.trained ? t('aiModelMeta', { samples: m.samples, classes: m.classes }) : t('aiColdStart')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IntelligenceDashboard() {
  const t = useTranslations('intelligence');
  const [days, setDays] = useState(90);

  const overview = useQuery({ queryKey: ['intelligence', 'overview', days], queryFn: () => intelligenceApi.overview(days) });
  const reliability = useQuery({ queryKey: ['intelligence', 'reliability', days], queryFn: () => intelligenceApi.reliability(days) });
  const patterns = useQuery({ queryKey: ['intelligence', 'patternSignals'], queryFn: () => intelligenceApi.patternSignals() });
  const automation = useQuery({ queryKey: ['intelligence', 'automation', days], queryFn: () => intelligenceApi.automationOpportunities(days) });

  const ov = overview.data;

  const totalSavingsHours = useMemo(
    () => (automation.data ?? []).reduce((sum, a) => sum + (a.potentialSavingsMinutes * a.frequency) / 60, 0),
    [automation.data],
  );

  const rootCauseSlices = useMemo(
    () =>
      (ov?.rootCauseDistribution ?? [])
        .slice()
        .sort((a, b) => b.count - a.count)
        .map((r, i) => ({ label: r.category, value: r.count, color: SERIES_PALETTE[i % SERIES_PALETTE.length] })),
    [ov],
  );

  const confidenceBars = useMemo(() => {
    const src = ov?.reliabilityByConfidence ?? reliability.data?.byConfidence ?? [];
    return src.map((c) => ({
      label: c.confidence,
      value: Math.round((c.acceptanceRate ?? 0) * 100),
      display: formatPct(c.acceptanceRate ?? 0),
      color: healthColor(c.acceptanceRate ?? 0, 0.6, 0.4),
    }));
  }, [ov, reliability.data]);

  const refetchAll = () => {
    overview.refetch();
    reliability.refetch();
    patterns.refetch();
    automation.refetch();
  };

  if (overview.isLoading && reliability.isLoading) return <LoadingState label={t('analyzing')} />;

  const coverage = ov && ov.playbooksTotal > 0 ? ov.playbooksPublished / ov.playbooksTotal : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div className="grid h-10 w-10 place-items-center rounded-lg border border-primary/20 bg-primary-soft">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">{t('dashboardTitle')}</h1>
          <p className="text-xs text-muted">{t('dashboardSubtitle')}</p>
        </div>
        <div className="ml-auto flex items-center gap-sm">
          <div className="w-40">
            <Select
              value={days}
              onChange={setDays}
              options={[
                { value: 30, label: t('last30days') },
                { value: 90, label: t('last90days') },
                { value: 180, label: t('last180days') },
              ]}
            />
          </div>
          <button
            type="button"
            onClick={refetchAll}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted transition-colors hover:text-text"
            aria-label={t('retry')}
          >
            <RefreshCw className={overview.isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-lg">
          {/* Cartões de topo */}
          {ov && (
            <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
              <StatCard
                icon={BookOpen}
                label={t('playbookCoverage')}
                value={formatPct(coverage)}
                subtitle={t('playbookCoverageHint', { published: ov.playbooksPublished, total: ov.playbooksTotal })}
                progress={coverage}
                accent="primary"
                delay={0}
              />
              <StatCard
                icon={Sparkles}
                label={t('acceptanceRate')}
                value={formatPct(ov.acceptanceRate)}
                subtitle={t('feedbackCount', { count: ov.totalFeedback })}
                progress={ov.acceptanceRate}
                accentColor={healthColor(ov.acceptanceRate, 0.6, 0.4)}
                delay={0.05}
              />
              <StatCard
                icon={ShieldCheck}
                label={t('helpfulRate')}
                value={formatPct(ov.helpfulRate)}
                subtitle={t('fromPastResolutions')}
                progress={ov.helpfulRate}
                accentColor={healthColor(ov.helpfulRate, 0.6, 0.4)}
                delay={0.1}
              />
              <StatCard
                icon={Zap}
                label={t('automationOpportunities')}
                value={String(ov.automationOpportunityCount)}
                subtitle={totalSavingsHours > 0 ? t('savingsPerMonth', { hours: Math.round(totalSavingsHours) }) : t('automationHint')}
                accent="warning"
                delay={0.15}
              />
            </div>
          )}

          <AiHealthCard />

          {/* Confiabilidade por faixa + causas raiz */}
          <div className="grid gap-lg lg:grid-cols-2">
            <ChartCard title={t('reliabilityByConfidence')} icon={<Target className="h-4 w-4 text-primary" />}>
              {confidenceBars.length === 0 ? (
                <p className="py-8 text-center text-sm text-dim">{t('noSignal')}</p>
              ) : (
                <>
                  <HBarChart items={confidenceBars} labelWidth={72} />
                  <p className="mt-md text-xs text-muted">{t('calibrationHint')}</p>
                </>
              )}
            </ChartCard>

            <ChartCard title={t('rootCausePareto')} icon={<BarChart3 className="h-4 w-4 text-primary" />}>
              {rootCauseSlices.length === 0 ? (
                <p className="py-8 text-center text-sm text-dim">{t('noPatternsYet')}</p>
              ) : (
                <>
                  <ParetoChart items={rootCauseSlices} barsLabel={t('paretoCases')} cumulativeLabel={t('paretoCumulative')} />
                  <p className="mt-md text-xs text-muted">{t('paretoHint')}</p>
                </>
              )}
            </ChartCard>
          </div>

          {/* Efetividade de playbooks */}
          <ChartCard title={t('topPlaybooksTitle')} icon={<BookOpen className="h-4 w-4 text-primary" />}>
            {reliability.isLoading ? (
              <LoadingState />
            ) : (reliability.data?.topPlaybooks ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-dim">{t('noPlaybooks')}</p>
            ) : (
              <div className="flex flex-col divide-y divide-border/60">
                {(reliability.data?.topPlaybooks ?? []).slice(0, 8).map((p) => (
                  <div key={p.playbookId} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{p.title}</p>
                      <p className="text-xs text-dim">{t('appliedTimes', { count: p.applied })}</p>
                    </div>
                    <div className="w-32 shrink-0">
                      <ProgressBar value={p.successRate} color={healthColor(p.successRate, 0.6, 0.4)} />
                    </div>
                    <span className={cn('w-12 shrink-0 text-right text-sm font-bold', healthTextClass(p.successRate, 0.6, 0.4))}>
                      {formatPct(p.successRate)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Oportunidades de automação */}
          <ChartCard
            title={t('automationOpportunities')}
            icon={<Zap className="h-4 w-4 text-warning" />}
            action={
              totalSavingsHours > 0 ? (
                <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                  {t('savingsPerMonth', { hours: Math.round(totalSavingsHours) })}
                </span>
              ) : null
            }
          >
            {automation.isLoading ? (
              <LoadingState />
            ) : (automation.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-dim">{t('noAutomationYet')}</p>
            ) : (
              <div className="grid gap-md md:grid-cols-2">
                {(automation.data ?? []).slice(0, 8).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/10">
                      <Zap className="h-4 w-4 text-warning" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{a.description}</p>
                      <p className="text-[11px] text-dim">
                        {a.category} · {t('occurrences', { count: a.frequency })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-warning">{formatMinutes(a.potentialSavingsMinutes)}</p>
                      <p className="text-[10px] text-dim">{t('perOccurrence')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>

          {/* Padrões minerados */}
          <ChartCard title={t('patterns')} icon={<GitBranch className="h-4 w-4 text-primary" />}>
            {patterns.isLoading ? (
              <LoadingState />
            ) : (patterns.data ?? []).length === 0 ? (
              <p className="py-8 text-center text-sm text-dim">{t('noPatternsYet')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(patterns.data ?? []).slice(0, 10).map((p, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3"
                  >
                    <div className="flex flex-1 flex-wrap items-center gap-1.5">
                      {p.antecedent.map((a) => (
                        <PatternChip key={a} token={a} tone="neutral" t={t} />
                      ))}
                      <ArrowRight className="h-3.5 w-3.5 text-dim" />
                      {p.consequent.map((c) => (
                        <PatternChip key={c} token={c} tone="primary" t={t} />
                      ))}
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs">
                      <Metric label={t('confidence')} value={formatPct(p.confidence)} />
                      <Metric label={t('support')} value={formatPct(p.support)} />
                      <Metric
                        label={t('lift')}
                        value={`${p.lift.toFixed(2)}×`}
                        valueClass={p.lift >= 1 ? 'text-success' : 'text-muted'}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

/** Humaniza um valor de token: UPPER_SNAKE → "Título", PascalCase → "Palavras separadas". */
function humanizeToken(v: string): string {
  if (v === v.toUpperCase()) {
    const s = v.replace(/_/g, ' ').toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return v.replace(/([a-z])([A-Z])/g, '$1 $2');
}

/** Chip legível para um token de padrão ("symptom:SERVIDOR" → Sintoma · Servidor). */
function PatternChip({ token, tone, t }: { token: string; tone: 'neutral' | 'primary'; t: ReturnType<typeof useTranslations> }) {
  const idx = token.indexOf(':');
  const prefix = idx >= 0 ? token.slice(0, idx) : '';
  const value = idx >= 0 ? token.slice(idx + 1) : token;
  const prefixKey = ({ symptom: 'patternSymptom', category: 'patternCategory', action: 'patternAction' } as Record<string, string>)[prefix];
  const label = prefixKey ? t(prefixKey as Parameters<typeof t>[0]) : '';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', tone === 'primary' ? 'bg-primary-soft text-primary' : 'bg-panel-2 text-text')}>
      {label && <span className="text-[9px] font-semibold uppercase tracking-wide opacity-60">{label}</span>}
      {humanizeToken(value)}
    </span>
  );
}

function Metric({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="text-right">
      <p className="text-[9px] uppercase tracking-wide text-dim">{label}</p>
      <p className={cn('font-bold tabular-nums', valueClass ?? 'text-text')}>{value}</p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  progress,
  accent,
  accentColor,
  delay = 0,
}: {
  icon: typeof Brain;
  label: string;
  value: string | number;
  subtitle?: string;
  progress?: number;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
  accentColor?: string;
  delay?: number;
}) {
  const bg =
    accent === 'success'
      ? 'bg-success/10 text-success'
      : accent === 'warning'
        ? 'bg-warning/10 text-warning'
        : accent === 'danger'
          ? 'bg-danger/10 text-danger'
          : 'bg-primary-soft text-primary';
  const barColor = accentColor ?? 'var(--orbit-color-primary)';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="card-surface flex flex-col gap-2 p-lg"
    >
      <div className="flex items-start gap-3">
        <div className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', bg)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-dim">{label}</p>
          <p className="truncate text-2xl font-bold text-text" title={String(value)}>
            {value}
          </p>
        </div>
      </div>
      {typeof progress === 'number' && <ProgressBar value={progress} color={barColor} />}
      {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
    </motion.div>
  );
}
