'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ShieldCheck, Target, ThumbsUp, MessageSquare, Route, Gauge } from 'lucide-react';
import { intelligenceApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import type { ConfidenceReliability } from '@/shared/api/types';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

const WINDOWS = [30, 90, 180] as const;

/** Formata uma fração 0..1 como porcentagem inteira. */
function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent = 'primary',
  delay = 0,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string | number;
  subtitle?: string;
  accent?: 'primary' | 'success' | 'warning' | 'danger';
  delay?: number;
}) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-danger/10 text-danger',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="card-surface flex items-start gap-3 p-4"
    >
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', colors[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-dim">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

const CONFIDENCE_STYLE: Record<ConfidenceReliability['confidence'], string> = {
  High: 'bg-success/15 text-success',
  Medium: 'bg-warning/15 text-warning',
  Low: 'bg-panel-2 text-dim',
  Unknown: 'bg-panel-2 text-dim',
};

/** Ordem canônica das faixas de confiança (alta primeiro — a prova de calibração). */
const CONFIDENCE_ORDER: ConfidenceReliability['confidence'][] = ['High', 'Medium', 'Low', 'Unknown'];

export function ReliabilityView() {
  const t = useTranslations('reliability');
  const tc = useTranslations('common');
  const [days, setDays] = useState<number>(90);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['intelligence', 'reliability', days],
    queryFn: () => intelligenceApi.reliability(days),
    retry: false,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />;

  const hasData = !!data && data.totalFeedback > 0;

  const byConfidence = data
    ? [...data.byConfidence].sort(
        (a, b) => CONFIDENCE_ORDER.indexOf(a.confidence) - CONFIDENCE_ORDER.indexOf(b.confidence),
      )
    : [];
  const topPlaybooks = data?.topPlaybooks ?? [];

  return (
    <div className="flex flex-col gap-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
        {/* Window selector */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDays(w)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                days === w ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text',
              )}
            >
              {t('windowDays', { days: w })}
            </button>
          ))}
        </div>
      </div>

      {!hasData ? (
        <EmptyState icon={ShieldCheck} message={t('empty')} />
      ) : (
        <>
          {/* Top cards */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Target} label={t('acceptanceRate')} value={pct(data!.acceptanceRate)} accent="primary" delay={0} />
            <StatCard icon={ThumbsUp} label={t('helpfulRate')} value={pct(data!.helpfulRate)} accent="success" delay={0.05} />
            <StatCard icon={MessageSquare} label={t('totalFeedback')} value={data!.totalFeedback} accent="warning" delay={0.1} />
            <StatCard
              icon={Gauge}
              label={t('acceptedHelpful')}
              value={`${data!.accepted} / ${data!.helpful}`}
              subtitle={t('acceptedHelpfulHint')}
              accent="primary"
              delay={0.15}
            />
          </div>

          {/* Calibration table */}
          <div className="card-surface overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-3">
              <Gauge className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-text">{t('calibrationTitle')}</p>
              <span className="text-xs text-muted">{t('calibrationHint')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-[11px] font-semibold uppercase tracking-wider text-dim">
                    <th className="px-4 py-2.5">{t('colConfidence')}</th>
                    <th className="px-4 py-2.5 text-right">{t('colOffered')}</th>
                    <th className="px-4 py-2.5 text-right">{t('colAccepted')}</th>
                    <th className="px-4 py-2.5 text-right">{t('colHelpful')}</th>
                    <th className="px-4 py-2.5 text-right">{t('colHelpfulRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {byConfidence.map((row) => (
                    <tr key={row.confidence} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', CONFIDENCE_STYLE[row.confidence])}>
                          {t(`confidence.${row.confidence}` as 'confidence.High')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{row.offered}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{row.accepted}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted">{row.helpful}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-panel-2 sm:block">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                row.confidence === 'High' ? 'bg-success' : row.confidence === 'Medium' ? 'bg-warning' : 'bg-dim',
                              )}
                              style={{ width: `${Math.round((row.helpfulRate || 0) * 100)}%` }}
                            />
                          </div>
                          <span className="tabular-nums font-semibold text-text">{pct(row.helpfulRate)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top playbooks */}
          <div className="card-surface overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
              <Route className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-text">{t('topPlaybooksTitle')}</p>
            </div>
            {topPlaybooks.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-muted">{t('noPlaybooks')}</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {topPlaybooks.map((p, i) => (
                  <li key={p.playbookId} className="flex items-center gap-3 px-4 py-3">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text">{p.title}</p>
                      <p className="text-[11px] text-dim">{t('appliedTimes', { count: p.applied })}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-success/10 px-2.5 py-1 text-xs font-bold text-success">
                      {pct(p.successRate)} {t('success')}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
