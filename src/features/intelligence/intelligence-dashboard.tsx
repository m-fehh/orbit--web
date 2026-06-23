'use client';

import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Brain, TrendingUp, Zap, Target, BarChart3, Clock,
  Sparkles, Lightbulb, Shield,
} from 'lucide-react';
import { intelligenceApi, analyticsApi } from '@/shared/api/endpoints';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

function StatCard({ icon: Icon, label, value, subtitle, accent = 'primary', delay = 0 }: {
  icon: typeof Brain; label: string; value: string | number; subtitle?: string; accent?: 'primary' | 'success' | 'warning' | 'danger'; delay?: number;
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
      className="card-surface p-4 flex items-start gap-3"
    >
      <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', colors[accent])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-dim">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

export function IntelligenceDashboard() {
  const t = useTranslations('intelligence');

  const kpis = useQuery({ queryKey: ['analytics', 'kpis', 30], queryFn: () => analyticsApi.kpis(30) });
  const patterns = useQuery({ queryKey: ['intelligence', 'patterns'], queryFn: () => intelligenceApi.patterns() });
  const automation = useQuery({ queryKey: ['intelligence', 'automation'], queryFn: () => intelligenceApi.automationOpportunities() });
  const dashboard = useQuery({ queryKey: ['analytics', 'dashboard', 30], queryFn: () => analyticsApi.dashboard(30) });

  if (kpis.isLoading && patterns.isLoading) return <LoadingState />;

  const kpiData = kpis.data;
  const totalSavingsHours = (automation.data ?? []).reduce((sum, a) => sum + (a.potentialSavingsMinutes * a.frequency) / 60, 0);

  return (
    <div className="flex flex-col gap-6 p-6 overflow-y-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">{t('dashboardTitle')}</h1>
          <p className="text-xs text-muted">{t('dashboardSubtitle')}</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      {kpiData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="MTTR" value={`${kpiData.mttrHours.toFixed(1)}h`} subtitle={t('avgResolutionTime')} accent="primary" delay={0} />
          <StatCard icon={Shield} label="SLA" value={`${Math.round(kpiData.slaComplianceRate * 100)}%`} subtitle={`${kpiData.slaBreaches} breaches`} accent={kpiData.slaComplianceRate > 0.9 ? 'success' : 'warning'} delay={0.05} />
          <StatCard icon={TrendingUp} label={t('resolutionRate')} value={`${Math.round(kpiData.resolutionRate * 100)}%`} subtitle={`${kpiData.resolvedTickets}/${kpiData.totalTickets}`} accent="success" delay={0.1} />
          <StatCard icon={Sparkles} label={t('knowledgeReuse')} value={`${Math.round(kpiData.knowledgeReuseRate * 100)}%`} subtitle={t('fromPastResolutions')} accent="primary" delay={0.15} />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Patterns */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="card-surface p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide">{t('patterns')}</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">{(patterns.data ?? []).length}</span>
          </div>
          {patterns.isLoading ? (
            <LoadingState />
          ) : (patterns.data ?? []).length === 0 ? (
            <p className="text-xs text-dim py-8 text-center">{t('noPatternsYet')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(patterns.data ?? []).slice(0, 8).map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-bg-subtle/50 transition-colors">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10">
                    <Lightbulb className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text truncate">{p.name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-success">{Math.round((p.successRate ?? 0) * 100)}%</p>
                    <p className="text-[10px] text-dim">{p.usageCount}× used</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Automation Opportunities */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25 }}
          className="card-surface p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-warning" />
            <h2 className="text-sm font-bold uppercase tracking-wide">{t('automationOpportunities')}</h2>
            {totalSavingsHours > 0 && (
              <span className="ml-auto rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                ~{Math.round(totalSavingsHours)}h/mo savings
              </span>
            )}
          </div>
          {automation.isLoading ? (
            <LoadingState />
          ) : (automation.data ?? []).length === 0 ? (
            <p className="text-xs text-dim py-8 text-center">{t('noAutomationYet')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(automation.data ?? []).slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-bg-subtle/50 transition-colors">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warning/10">
                    <Zap className="h-4 w-4 text-warning" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{a.description}</p>
                    <p className="text-[11px] text-dim">{a.category} · {a.frequency}× occurrences</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-warning">{Math.round(a.potentialSavingsMinutes / 60)}h</p>
                    <p className="text-[10px] text-dim">per occurrence</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Root causes by category */}
      {dashboard.data && Object.keys(dashboard.data.rootCausesByCategory).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card-surface p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wide">{t('rootCauseDistribution')}</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.entries(dashboard.data.rootCausesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, count]) => {
              const total = Object.values(dashboard.data!.rootCausesByCategory).reduce((s, v) => s + v, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={cat} className="rounded-lg border border-border p-3 text-center">
                  <p className="text-2xl font-bold text-text">{count}</p>
                  <p className="text-[10px] font-medium text-dim uppercase tracking-wide">{cat}</p>
                  <div className="mt-1.5 h-1 rounded-full bg-bg-subtle overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">{pct}%</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
