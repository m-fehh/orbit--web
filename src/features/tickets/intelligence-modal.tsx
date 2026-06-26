'use client';

import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ThumbsUp, ThumbsDown, Check, BookOpen, Target, Lightbulb, Sparkles,
  Zap, ExternalLink, BarChart3, Clock, FileText, ArrowRight, Layers,
  ArrowUpRight,
} from 'lucide-react';
import { intelligenceApi, knowledgeApi, ticketsApi } from '@/shared/api/endpoints';
import { ticketResolutionApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import type { RootCauseCandidate, ResolutionSuggestion } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openTicketTab } from './ticket-actions';
import { Button } from '@/shared/ui/button';
import { PulseDot } from '@/shared/ui/motion';
import { cn } from '@/shared/lib/utils';

const MODAL_ID = 'intelligence-modal';

function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export function openIntelligenceModal(ticketId: number, ticketTitle: string, modalTitle?: string) {
  useWindowStore.getState().open({
    id: `${MODAL_ID}-${ticketId}`,
    title: modalTitle ?? `Orbit Intelligence — ${ticketTitle}`,
    icon: <Brain className="h-4 w-4" />,
    modal: true,
    width: 960,
    height: 800,
    content: <IntelligenceModalContent ticketId={ticketId} ticketTitle={ticketTitle} />,
  });
}

type FeedbackState = Record<string, 'up' | 'down'>;

function AnalyzingState() {
  const t = useTranslations('intelligence');
  const steps = [
    { icon: Target, label: t('analyzingSteps.scanning'), delay: 0 },
    { icon: BarChart3, label: t('analyzingSteps.matching'), delay: 0.4 },
    { icon: Brain, label: t('analyzingSteps.reasoning'), delay: 0.8 },
    { icon: Lightbulb, label: t('analyzingSteps.generating'), delay: 1.2 },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-lg p-xl">
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring' }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative rounded-full bg-primary/10 p-lg">
          <Brain className="h-8 w-8 text-primary" />
        </div>
      </motion.div>
      <div className="flex flex-col items-center gap-sm">
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-sm font-medium text-text">
          {t('analyzing')}
        </motion.p>
        <div className="flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: step.delay, duration: 0.3 }} className="flex items-center gap-2 text-xs text-muted">
              <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: step.delay }}>
                <step.icon className="h-3.5 w-3.5 text-primary" />
              </motion.div>
              {step.label}
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoDataState() {
  const t = useTranslations('intelligence');
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex flex-1 flex-col items-center justify-center gap-md p-xl text-center">
      <div className="rounded-2xl bg-primary/5 p-lg">
        <Brain className="h-12 w-12 text-primary/30" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{t('noData')}</p>
        <p className="max-w-xs text-xs text-muted">{t('noDataHint')}</p>
      </div>
    </motion.div>
  );
}

function CauseCard({ cause, index, t }: { cause: RootCauseCandidate; index: number; t: ReturnType<typeof useTranslations<'intelligence'>> }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group rounded-xl border border-border bg-panel overflow-hidden transition-all hover:border-primary/40 hover:shadow-md"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-3.5 p-4 text-left"
      >
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <span className="text-[11px] font-bold">#{index + 1}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-text">{cause.category}</p>
            {cause.aiEnhanced && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">AI</span>
            )}
          </div>
          {cause.description && (
            <p className={cn('mt-1 text-xs leading-relaxed text-muted', !expanded && 'line-clamp-2')}>{cause.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-bold tabular-nums text-primary">
            {pct(cause.confidenceScore)}
          </span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 px-sm pb-sm pt-2">
              {cause.coOccurrencePatterns.length > 0 && (
                <div className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-dim mb-1">{t('patternContext')}</p>
                  <div className="flex flex-wrap gap-1">
                    {cause.coOccurrencePatterns.map(p => (
                      <span key={p} className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">{p}</span>
                    ))}
                  </div>
                </div>
              )}
              {cause.supportingTicketIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openRelatedTicketsModal(cause.supportingTicketIds, t('relatedTicketsTitle')); }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/15 transition-colors"
                >
                  <Layers className="h-3 w-3" />
                  {t('similarTickets', { count: cause.supportingTicketIds.length })}
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="h-1 bg-border/30">
        <div className="h-full rounded-r bg-primary/40 transition-all" style={{ width: `${Math.round((cause.confidenceScore ?? 0) * 100)}%` }} />
      </div>
    </motion.div>
  );
}

function ResolutionCard({ res, index, feedback, onFeedback, onApply, applyPending, t }: {
  res: ResolutionSuggestion;
  index: number;
  feedback: FeedbackState;
  onFeedback: (id: number, accepted: boolean) => void;
  onApply: (r: ResolutionSuggestion) => void;
  applyPending: boolean;
  t: ReturnType<typeof useTranslations<'intelligence'>>;
}) {
  const key = String(res.resolutionId ?? index);
  const fb = feedback[key];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group rounded-xl border border-border bg-panel p-4 transition-all hover:border-success/40 hover:shadow-md"
    >
      <div className="flex items-start gap-3.5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success/10 text-success ring-1 ring-success/20">
          <Zap className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-relaxed text-text">{res.summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {res.successRate != null && !isNaN(res.successRate) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                {pct(res.successRate)} {t('success')}
              </span>
            )}
            {res.similarityScore != null && !isNaN(res.similarityScore) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                {pct(res.similarityScore)} {t('similar')}
              </span>
            )}
            {res.reusedCount > 0 && (
              <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-dim">
                {res.reusedCount}× {t('reuse')}
              </span>
            )}
            {(res.matchedTerms ?? []).slice(0, 3).map(term => (
              <span key={term} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] text-primary">{term}</span>
            ))}
          </div>
        </div>
      </div>

      {res.ticketId != null && (
        <button
          type="button"
          onClick={() => openTicketTab({ id: res.ticketId, number: String(res.ticketId) })}
          className="mt-3 ml-[3.125rem] inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          {t('sourceTicket')} #{res.ticketId}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}

      <div className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-3.5">
        <Button
          size="sm"
          className="gap-1.5"
          loading={applyPending}
          onClick={() => onApply(res)}
        >
          <Check className="h-3.5 w-3.5" />
          {t('applySolution')}
        </Button>
        {res.resolutionId != null && (
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-1 text-[10px] text-dim">{t('wasHelpful')}</span>
            <button
              type="button"
              onClick={() => onFeedback(res.resolutionId, true)}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-success/30 hover:bg-success/10 hover:text-success',
                fb === 'up' && 'border-success/30 bg-success/15 text-success',
              )}
              disabled={!!fb}
              aria-label={t('helpfulYes')}
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback(res.resolutionId, false)}
              className={cn(
                'grid h-8 w-8 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger',
                fb === 'down' && 'border-danger/30 bg-danger/15 text-danger',
              )}
              disabled={!!fb}
              aria-label={t('helpfulNo')}
            >
              <ThumbsDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function openRelatedTicketsModal(ticketIds: number[], title?: string) {
  useWindowStore.getState().open({
    id: `related-tickets-${ticketIds.join('-')}`,
    title: title ?? 'Related Tickets',
    icon: <Layers className="h-4 w-4" />,
    modal: true,
    width: 520,
    height: 420,
    content: <RelatedTicketsPreview ticketIds={ticketIds} />,
  });
}

function RelatedTicketsPreview({ ticketIds }: { ticketIds: number[] }) {
  const queries = useQueries({
    queries: ticketIds.map((tid) => ({
      queryKey: ['tickets', 'detail', tid],
      queryFn: () => ticketsApi.get(tid),
      retry: false as const,
    })),
  });
  return (
    <div className="flex flex-col gap-2 p-md overflow-y-auto max-h-[400px]">
      {queries.map((q, i) => {
        const tid = ticketIds[i];
        if (q.isLoading) return <div key={tid} className="animate-pulse rounded-lg bg-panel-2/50 h-16" />;
        if (q.isError || !q.data) return <div key={tid} className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs text-danger">#{tid}</div>;
        const tk = q.data;
        return (
          <div key={tid} className="flex items-center gap-3 rounded-lg border border-border bg-panel/60 p-3 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => openTicketTab({ id: tk.id, number: tk.number, title: tk.title })}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-primary">#{tk.number}</span>
              </div>
              <p className="text-sm font-medium text-text truncate">{tk.title}</p>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-dim" />
          </div>
        );
      })}
    </div>
  );
}

function IntelligenceModalContent({ ticketId, ticketTitle }: { ticketId: number; ticketTitle: string }) {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [activeTab, setActiveTab] = useState<'overview' | 'causes' | 'resolutions' | 'knowledge'>('overview');

  const report = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
    retry: false,
  });

  const knowledge = useQuery({
    queryKey: ['intelligence', 'knowledge', ticketId],
    queryFn: () => knowledgeApi.list({ search: ticketTitle, pageSize: 5 }),
  });

  const applyResolution = useMutation({
    mutationFn: (r: { resolutionId: number; summary: string }) =>
      ticketResolutionApi.resolveWithAi(ticketId, {
        rootCauseId: 0,
        summary: r.summary,
        resolutionSteps: '',
        notifyCustomer: true,
      }),
    onSuccess: () => {
      toast.success(t('appliedSuccess'));
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('applyError'))),
  });

  const sendFeedback = useMutation({
    mutationFn: (v: { resolutionId: number; accepted: boolean }) =>
      ticketsApi.recommendationFeedback(ticketId, { resolutionId: v.resolutionId, accepted: v.accepted, helpful: v.accepted }),
    onSuccess: (_d, v) => {
      setFeedback((f) => ({ ...f, [v.resolutionId]: v.accepted ? 'up' : 'down' }));
      toast.success(t('feedbackSent'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('feedbackError'))),
  });

  if (report.isLoading) return <AnalyzingState />;
  if (report.isError) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center justify-center gap-md p-xl text-center" role="alert">
        <div className="rounded-2xl bg-danger/5 p-lg">
          <Brain className="h-10 w-10 text-danger/40" />
        </div>
        <p className="text-sm font-medium text-text">{t('analysisError')}</p>
        <Button variant="secondary" size="sm" onClick={() => report.refetch()}>{t('retry')}</Button>
      </motion.div>
    );
  }

  const causes = report.data?.rootCauseCandidates ?? [];
  const resolutions = report.data?.resolutionSuggestions ?? [];
  const knData = knowledge.data?.items ?? [];

  if (causes.length === 0 && resolutions.length === 0 && knData.length === 0) {
    return <NoDataState />;
  }

  const topCause = causes[0];
  const topResolution = resolutions[0];

  const tabs = [
    { key: 'overview' as const, icon: Brain, label: t('summary') },
    { key: 'causes' as const, icon: Target, label: t('rootCauses'), count: causes.length },
    { key: 'resolutions' as const, icon: Lightbulb, label: t('resolutions'), count: resolutions.length },
    { key: 'knowledge' as const, icon: BookOpen, label: t('relatedKnowledge'), count: knData.length },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-bg">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-6 py-5">
        <div className="flex items-start gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/20">
            <Brain className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-text">Orbit Intelligence</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                <PulseDot color="bg-primary" /> AI
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">{ticketTitle}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-dim">
              <Sparkles className="h-3 w-3 text-primary" />
              {t('aiDisclaimer')}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border bg-bg-subtle/30 px-3">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'relative flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-semibold transition-all',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-dim hover:text-text',
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count != null && tab.count > 0 && (
              <span className={cn(
                'rounded-full px-1.5 py-px text-[10px] font-bold',
                activeTab === tab.key ? 'bg-primary/15 text-primary' : 'bg-border/50 text-dim',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-5 p-6">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: Target, color: 'text-primary', bg: 'bg-primary/10', n: causes.length, label: t('rootCauses') },
                  { icon: Lightbulb, color: 'text-success', bg: 'bg-success/10', n: resolutions.length, label: t('resolutions') },
                  { icon: BookOpen, color: 'text-warning', bg: 'bg-warning/10', n: knData.length, label: t('relatedKnowledge') },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-panel p-4">
                    <div className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', s.bg, s.color)}>
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold leading-none text-text">{s.n}</p>
                      <p className="mt-1 text-[11px] text-dim">{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {topResolution && (
                <div className="rounded-2xl border border-success/30 bg-gradient-to-br from-success/8 to-transparent p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-success/15 text-success"><Zap className="h-4 w-4" /></span>
                    <p className="text-sm font-bold text-success">{t('suggestedSolution')}</p>
                    {topResolution.successRate != null && !isNaN(topResolution.successRate) && (
                      <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">{pct(topResolution.successRate)} {t('success')}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-text">{topResolution.summary}</p>
                  <div className="mt-4 flex items-center gap-3">
                    <Button
                      className="gap-1.5"
                      loading={applyResolution.isPending}
                      onClick={() => applyResolution.mutate({ resolutionId: topResolution.resolutionId, summary: topResolution.summary })}
                    >
                      <Check className="h-4 w-4" />
                      {t('applySolution')}
                    </Button>
                    {topResolution.reusedCount > 0 && (
                      <span className="text-[11px] text-dim">{topResolution.reusedCount}× {t('reuse')}</span>
                    )}
                  </div>
                </div>
              )}

              {topCause && (
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/8 to-transparent p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary"><Target className="h-4 w-4" /></span>
                    <p className="text-sm font-bold text-primary">{t('probableCause')}</p>
                    <span className="ml-auto rounded-full bg-primary/15 px-2.5 py-1 text-xs font-bold text-primary">{pct(topCause.confidenceScore)}</span>
                  </div>
                  <p className="text-sm font-semibold text-text">{topCause.category}</p>
                  {topCause.description && (
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">{topCause.description}</p>
                  )}
                  {topCause.coOccurrencePatterns.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {topCause.coOccurrencePatterns.map(p => (
                        <span key={p} className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{p}</span>
                      ))}
                    </div>
                  )}
                  {topCause.supportingTicketIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openRelatedTicketsModal(topCause.supportingTicketIds, t('relatedTicketsTitle'))}
                      className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline"
                    >
                      <Layers className="h-3 w-3" />
                      {t('similarTickets', { count: topCause.supportingTicketIds.length })}
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              <div className="flex gap-3">
                {causes.length > 1 && (
                  <button type="button" onClick={() => setActiveTab('causes')} className="group flex flex-1 items-center justify-between rounded-xl border border-border bg-panel p-4 text-left transition-colors hover:border-primary/40">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-dim">{t('rootCauses')}</p>
                      <p className="mt-0.5 text-xs text-muted">+{causes.length - 1} {t('otherPossibleCauses').toLowerCase()}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                )}
                {resolutions.length > 1 && (
                  <button type="button" onClick={() => setActiveTab('resolutions')} className="group flex flex-1 items-center justify-between rounded-xl border border-border bg-panel p-4 text-left transition-colors hover:border-success/40">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-dim">{t('resolutions')}</p>
                      <p className="mt-0.5 text-xs text-muted">{t('moreAlternatives', { count: resolutions.length - 1 })}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-success" />
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'causes' && (
            <motion.div key="causes" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3 p-6">
              {causes.map((rc, i) => (
                <CauseCard key={i} cause={rc} index={i} t={t} />
              ))}
              {causes.length === 0 && <p className="py-lg text-center text-xs text-dim">{t('noCauses')}</p>}
            </motion.div>
          )}

          {activeTab === 'resolutions' && (
            <motion.div key="resolutions" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3 p-6">
              {resolutions.map((r, i) => (
                <ResolutionCard
                  key={r.resolutionId ?? i}
                  res={r}
                  index={i}
                  feedback={feedback}
                  onFeedback={(id, accepted) => sendFeedback.mutate({ resolutionId: id, accepted })}
                  onApply={(r) => applyResolution.mutate({ resolutionId: r.resolutionId, summary: r.summary })}
                  applyPending={applyResolution.isPending}
                  t={t}
                />
              ))}
              {resolutions.length === 0 && <p className="py-lg text-center text-xs text-dim">{t('noResolutions')}</p>}
            </motion.div>
          )}

          {activeTab === 'knowledge' && (
            <motion.div key="knowledge" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-3 p-6">
              {knData.map((k, i) => (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group cursor-pointer rounded-xl border border-border bg-panel p-4 transition-all hover:border-warning/40 hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning ring-1 ring-warning/20"><BookOpen className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text group-hover:text-primary transition-colors">{k.title}</p>
                      {k.summary && <p className="mt-1 text-xs text-muted line-clamp-2">{k.summary}</p>}
                    </div>
                    <ExternalLink className="h-4 w-4 shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </motion.div>
              ))}
              {knData.length === 0 && <p className="py-lg text-center text-xs text-dim">{t('noKnowledge')}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-md border-t border-border bg-bg-subtle/30 px-6 py-2.5 text-[10px] text-dim">
        <span className="flex items-center gap-1.5">
          <Brain className="h-3 w-3 text-primary" />
          {t('brandFooter')}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          {t('poweredBy')}
        </span>
      </div>
    </div>
  );
}
