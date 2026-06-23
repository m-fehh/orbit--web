'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ThumbsUp, ThumbsDown, Check, BookOpen, Target, Lightbulb, Sparkles,
  Zap, ExternalLink, BarChart3, Clock, FileText, ArrowRight,
} from 'lucide-react';
import { intelligenceApi, knowledgeApi, ticketsApi } from '@/shared/api/endpoints';
import { ticketResolutionApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openTicketTab } from './ticket-actions';
import { Button } from '@/shared/ui/button';
import { ConfidenceBar, PulseDot } from '@/shared/ui/motion';
import { cn } from '@/shared/lib/utils';

const MODAL_ID = 'intelligence-modal';

function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

export function openIntelligenceModal(ticketId: number, ticketTitle: string) {
  useWindowStore.getState().open({
    id: `${MODAL_ID}-${ticketId}`,
    title: '',
    icon: <Brain className="h-4 w-4" />,
    modal: true,
    width: 680,
    height: 750,
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
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <div className="relative rounded-full bg-primary/10 p-lg">
          <Brain className="h-8 w-8 text-primary" />
        </div>
      </motion.div>

      <div className="flex flex-col items-center gap-sm">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm font-medium text-text"
        >
          {t('analyzing')}
        </motion.p>
        <div className="flex flex-col gap-1.5">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: step.delay, duration: 0.3 }}
              className="flex items-center gap-2 text-xs text-muted"
            >
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: step.delay }}
              >
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-1 flex-col items-center justify-center gap-md p-xl text-center"
    >
      <motion.div
        initial={{ scale: 0.8 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="rounded-2xl bg-primary/5 p-lg"
      >
        <Brain className="h-12 w-12 text-primary/30" />
      </motion.div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-text">{t('noData')}</p>
        <p className="max-w-xs text-xs text-muted">{t('noDataHint')}</p>
      </div>
    </motion.div>
  );
}

function IntelligenceModalContent({ ticketId, ticketTitle }: { ticketId: number; ticketTitle: string }) {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [activeTab, setActiveTab] = useState<'causes' | 'resolutions' | 'knowledge'>('causes');

  const rootCauses = useQuery({
    queryKey: ['intelligence', 'root-causes', ticketId],
    queryFn: () => intelligenceApi.ticketRootCauses(ticketId),
  });

  const resolutions = useQuery({
    queryKey: ['intelligence', 'resolutions', ticketId],
    queryFn: () => intelligenceApi.ticketResolutions(ticketId),
  });

  const knowledge = useQuery({
    queryKey: ['intelligence', 'knowledge', ticketId],
    queryFn: () => knowledgeApi.list({ search: ticketTitle, pageSize: 5 }),
  });

  const applyResolution = useMutation({
    mutationFn: (r: { resolutionId: number | null; summary: string; steps: string }) =>
      ticketResolutionApi.resolveWithAi(ticketId, {
        rootCauseId: 0,
        summary: r.summary,
        resolutionSteps: r.steps,
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

  const isLoading = rootCauses.isLoading && resolutions.isLoading;
  const isError = rootCauses.isError && resolutions.isError;

  if (isLoading) return <AnalyzingState />;
  if (isError) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-1 flex-col items-center justify-center gap-md p-xl text-center"
        role="alert"
      >
        <div className="rounded-2xl bg-danger/5 p-lg">
          <Brain className="h-10 w-10 text-danger/40" />
        </div>
        <p className="text-sm font-medium text-text">{t('analysisError')}</p>
        <Button variant="secondary" size="sm" onClick={() => { rootCauses.refetch(); resolutions.refetch(); }}>
          {t('retry')}
        </Button>
      </motion.div>
    );
  }

  const rcData = rootCauses.data ?? [];
  const resData = resolutions.data ?? [];
  const knData = knowledge.data?.items ?? [];

  if (rcData.length === 0 && resData.length === 0 && knData.length === 0) {
    return <NoDataState />;
  }

  const tabs = [
    { key: 'causes' as const, icon: Target, label: t('rootCauses'), count: rcData.length, color: 'text-primary' },
    { key: 'resolutions' as const, icon: Lightbulb, label: t('resolutions'), count: resData.length, color: 'text-success' },
    { key: 'knowledge' as const, icon: BookOpen, label: t('relatedKnowledge'), count: knData.length, color: 'text-warning' },
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
            <tab.icon className={cn('h-3.5 w-3.5', activeTab === tab.key ? tab.color : '')} />
            {tab.label}
            {tab.count > 0 && (
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
          {activeTab === 'causes' && (
            <motion.div
              key="causes"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-sm p-md"
            >
              {rcData.map((rc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="group rounded-lg border border-border bg-bg-subtle/50 p-sm transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                          #{i + 1}
                        </span>
                        <p className="text-sm font-medium text-text">{rc.title || rc.category}</p>
                      </div>
                      {rc.reasoning && (
                        <div className="mt-1.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-dim mb-0.5">{t('whyThisCause')}</p>
                          <p className="text-xs leading-relaxed text-muted">{rc.reasoning}</p>
                        </div>
                      )}
                    </div>
                    <span className="shrink-0 rounded-md bg-primary/10 px-2 py-1 text-xs font-bold tabular-nums text-primary">
                      {pct(rc.confidence)}
                    </span>
                  </div>
                  <ConfidenceBar value={rc.confidence ?? 0} className="mt-2" size="sm" />
                  {rc.category && rc.title && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="rounded bg-bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {rc.category}
                      </span>
                    </div>
                  )}
                </motion.div>
              ))}
              {rcData.length === 0 && (
                <p className="py-lg text-center text-xs text-dim">{t('noCauses')}</p>
              )}
            </motion.div>
          )}

          {activeTab === 'resolutions' && (
            <motion.div
              key="resolutions"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-sm p-md"
            >
              {resData.map((r, i) => {
                const key = String(r.resolutionId ?? i);
                const fb = feedback[key];
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="group rounded-lg border border-border bg-bg-subtle/50 p-sm transition-all hover:border-success/30 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 shrink-0 text-success" />
                          <p className="text-sm font-medium text-text">{r.summary}</p>
                        </div>
                        {r.steps && (
                          <div className="mt-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-dim mb-0.5">{t('analystSteps')}</p>
                            <p className="text-xs leading-relaxed text-muted whitespace-pre-line">{r.steps}</p>
                          </div>
                        )}
                      </div>
                      <span className="shrink-0 rounded-md bg-success/10 px-2 py-1 text-xs font-bold tabular-nums text-success">
                        {pct(r.confidence)}
                      </span>
                    </div>
                    <ConfidenceBar value={r.confidence ?? 0} className="mt-2" size="sm" />

                    {r.sourceTicketId != null && (
                      <button
                        type="button"
                        onClick={() => openTicketTab({ id: r.sourceTicketId!, number: String(r.sourceTicketId) })}
                        className="mt-2 flex items-center gap-1.5 text-[11px] text-primary hover:underline"
                      >
                        <FileText className="h-3 w-3" />
                        {t('sourceTicket')} #{r.sourceTicketId}
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}

                    <div className="mt-2 flex items-center gap-1.5 border-t border-border/50 pt-2">
                      <Button
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        loading={applyResolution.isPending}
                        onClick={() => applyResolution.mutate({ resolutionId: r.resolutionId, summary: r.summary, steps: r.steps })}
                      >
                        <Check className="h-3 w-3" />
                        {t('applySolution')}
                      </Button>
                      {r.resolutionId != null && (
                        <div className="ml-auto flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => sendFeedback.mutate({ resolutionId: r.resolutionId!, accepted: true })}
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
                            onClick={() => sendFeedback.mutate({ resolutionId: r.resolutionId!, accepted: false })}
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
              })}
              {resData.length === 0 && (
                <p className="py-lg text-center text-xs text-dim">{t('noResolutions')}</p>
              )}
            </motion.div>
          )}

          {activeTab === 'knowledge' && (
            <motion.div
              key="knowledge"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col gap-sm p-md"
            >
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
                      <p className="text-sm font-medium text-text group-hover:text-primary transition-colors">
                        {k.title}
                      </p>
                      {k.summary && <p className="mt-0.5 text-xs text-muted line-clamp-2">{k.summary}</p>}
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-dim opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                </motion.div>
              ))}
              {knData.length === 0 && (
                <p className="py-lg text-center text-xs text-dim">{t('noKnowledge')}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-md border-t border-border px-md py-2 text-[10px] text-dim">
        <span className="flex items-center gap-1">
          <Brain className="h-3 w-3 text-primary" />
          Orbit Intelligence
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {t('poweredBy')}
        </span>
      </div>
    </div>
  );
}
