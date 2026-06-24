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
      className="group rounded-lg border border-border bg-bg-subtle/50 overflow-hidden transition-all hover:border-primary/30 hover:shadow-sm"
    >
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-start gap-3 p-sm text-left"
      >
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <span className="text-[10px] font-bold">#{index + 1}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-text">{cause.category}</p>
            {cause.aiEnhanced && (
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">AI</span>
            )}
          </div>
          {cause.description && (
            <p className={cn('mt-0.5 text-xs leading-relaxed text-muted', !expanded && 'line-clamp-2')}>{cause.description}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary">
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="group rounded-lg border border-border bg-bg-subtle/50 p-sm transition-all hover:border-success/30 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
          <Zap className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-text">{res.summary}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {res.successRate != null && !isNaN(res.successRate) && (
              <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success">
                {pct(res.successRate)} {t('success')}
              </span>
            )}
            {res.similarityScore != null && !isNaN(res.similarityScore) && (
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                {pct(res.similarityScore)} {t('similar')}
              </span>
            )}
            {res.reusedCount > 0 && (
              <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[9px] font-medium text-dim">
                {res.reusedCount}× {t('reuse')}
              </span>
            )}
            {(res.matchedTerms ?? []).slice(0, 3).map(term => (
              <span key={term} className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] text-primary">{term}</span>
            ))}
          </div>
        </div>
      </div>

      {res.ticketId != null && (
        <button
          type="button"
          onClick={() => openTicketTab({ id: res.ticketId, number: String(res.ticketId) })}
          className="mt-2 ml-10 flex items-center gap-1.5 text-[11px] text-primary hover:underline"
        >
          <FileText className="h-3 w-3" />
          {t('sourceTicket')} #{res.ticketId}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}

      <div className="mt-2 ml-10 flex items-center gap-1.5 border-t border-border/50 pt-2">
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          loading={applyPending}
          onClick={() => onApply(res)}
        >
          <Check className="h-3 w-3" />
          {t('applySolution')}
        </Button>
        {res.resolutionId != null && (
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onFeedback(res.resolutionId, true)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-success/10 hover:text-success',
                fb === 'up' && 'bg-success/15 text-success',
              )}
              disabled={!!fb}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onFeedback(res.resolutionId, false)}
              className={cn(
                'grid h-7 w-7 place-items-center rounded text-muted transition-colors hover:bg-danger/10 hover:text-danger',
                fb === 'down' && 'bg-danger/15 text-danger',
              )}
              disabled={!!fb}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
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
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-gradient-to-r from-primary/5 to-transparent px-md py-2">
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <PulseDot color="bg-primary" />
          <Sparkles className="h-3 w-3 text-primary" />
          <span>{t('aiDisclaimer')}</span>
        </div>
      </div>

      <div className="flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 border-b-2 px-sm py-2.5 text-xs font-medium transition-all',
              activeTab === tab.key
                ? 'border-primary text-text'
                : 'border-transparent text-dim hover:border-border hover:text-muted',
            )}
          >
            <tab.icon className={cn('h-3.5 w-3.5', activeTab === tab.key ? 'text-primary' : '')} />
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
            <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-md p-md">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 text-center">
                  <Target className="mx-auto h-4 w-4 text-primary mb-1" />
                  <p className="text-lg font-bold text-text">{causes.length}</p>
                  <p className="text-[10px] text-dim">{t('rootCauses')}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 text-center">
                  <Lightbulb className="mx-auto h-4 w-4 text-success mb-1" />
                  <p className="text-lg font-bold text-text">{resolutions.length}</p>
                  <p className="text-[10px] text-dim">{t('resolutions')}</p>
                </div>
                <div className="rounded-lg border border-border bg-bg-subtle/50 p-3 text-center">
                  <BookOpen className="mx-auto h-4 w-4 text-warning mb-1" />
                  <p className="text-lg font-bold text-text">{knData.length}</p>
                  <p className="text-[10px] text-dim">{t('relatedKnowledge')}</p>
                </div>
              </div>

              {topCause && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-primary" />
                    <p className="text-xs font-semibold text-primary">{t('probableCause')}</p>
                    <span className="ml-auto rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{pct(topCause.confidenceScore)}</span>
                  </div>
                  <p className="text-sm font-medium text-text">{topCause.category}</p>
                  {topCause.description && (
                    <p className="mt-1 text-xs text-muted leading-relaxed">{topCause.description}</p>
                  )}
                  {topCause.coOccurrencePatterns.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {topCause.coOccurrencePatterns.map(p => (
                        <span key={p} className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">{p}</span>
                      ))}
                    </div>
                  )}
                  {topCause.supportingTicketIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => openRelatedTicketsModal(topCause.supportingTicketIds, t('relatedTicketsTitle'))}
                      className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                    >
                      <Layers className="h-3 w-3" />
                      {t('similarTickets', { count: topCause.supportingTicketIds.length })}
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {topResolution && (
                <div className="rounded-lg border border-success/20 bg-success/5 p-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-success" />
                    <p className="text-xs font-semibold text-success">{t('suggestedSolution')}</p>
                    {topResolution.successRate != null && !isNaN(topResolution.successRate) && (
                      <span className="ml-auto rounded-md bg-success/15 px-2 py-0.5 text-xs font-bold text-success">{pct(topResolution.successRate)} {t('success')}</span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-text">{topResolution.summary}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      loading={applyResolution.isPending}
                      onClick={() => applyResolution.mutate({ resolutionId: topResolution.resolutionId, summary: topResolution.summary })}
                    >
                      <Check className="h-3 w-3" />
                      {t('applySolution')}
                    </Button>
                    {topResolution.reusedCount > 0 && (
                      <span className="text-[10px] text-dim">{topResolution.reusedCount}× {t('reuse')}</span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                {causes.length > 1 && (
                  <button type="button" onClick={() => setActiveTab('causes')} className="flex-1 rounded-lg border border-border p-2.5 text-left hover:border-primary/30 transition-colors">
                    <p className="text-[10px] font-semibold text-dim uppercase">{t('rootCauses')}</p>
                    <p className="text-xs text-muted mt-0.5">+{causes.length - 1} {t('otherPossibleCauses').toLowerCase()}</p>
                  </button>
                )}
                {resolutions.length > 1 && (
                  <button type="button" onClick={() => setActiveTab('resolutions')} className="flex-1 rounded-lg border border-border p-2.5 text-left hover:border-success/30 transition-colors">
                    <p className="text-[10px] font-semibold text-dim uppercase">{t('resolutions')}</p>
                    <p className="text-xs text-muted mt-0.5">{t('moreAlternatives', { count: resolutions.length - 1 })}</p>
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'causes' && (
            <motion.div key="causes" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-sm p-md">
              {causes.map((rc, i) => (
                <CauseCard key={i} cause={rc} index={i} t={t} />
              ))}
              {causes.length === 0 && <p className="py-lg text-center text-xs text-dim">{t('noCauses')}</p>}
            </motion.div>
          )}

          {activeTab === 'resolutions' && (
            <motion.div key="resolutions" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-sm p-md">
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
            <motion.div key="knowledge" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-sm p-md">
              {knData.map((k, i) => (
                <motion.div
                  key={k.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group cursor-pointer rounded-lg border border-border bg-bg-subtle/50 p-sm transition-all hover:border-warning/30 hover:shadow-sm"
                >
                  <div className="flex items-start gap-2">
                    <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text group-hover:text-primary transition-colors">{k.title}</p>
                      {k.summary && <p className="mt-0.5 text-xs text-muted line-clamp-2">{k.summary}</p>}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </motion.div>
              ))}
              {knData.length === 0 && <p className="py-lg text-center text-xs text-dim">{t('noKnowledge')}</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-md border-t border-border px-md py-2 text-[10px] text-dim">
        <span className="flex items-center gap-1">
          <Brain className="h-3 w-3 text-primary" />
          {t('brandFooter')}
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('poweredBy')}
        </span>
      </div>
    </div>
  );
}
