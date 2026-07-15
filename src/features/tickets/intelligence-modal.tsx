'use client';

import { useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, ThumbsUp, ThumbsDown, Check, BookOpen, Target, Lightbulb, Sparkles,
  Zap, Clock, FileText, ArrowRight, Layers, ArrowUpRight,
  RefreshCw, AlertTriangle, TrendingUp, GitMerge, Tag,
  LayoutDashboard, Play, X, ChevronRight, Search, Activity, Shield
} from 'lucide-react';
import { intelligenceApi, ticketsApi } from '@/shared/api/endpoints';
import { ticketResolutionApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import type { RootCauseCandidate, ResolutionSuggestion, KnowledgeSuggestion } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { CopilotView } from '@/features/copilot/copilot-view';
import { openTicketTab } from './ticket-actions';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

// ─── Constants ──────────────────────────────────────────────────────────────
const MODAL_ID = 'intelligence-modal';
const STAGGER_DELAY = 0.06;

// ─── Translation Maps ───────────────────────────────────────────────────────
const ROOT_CAUSE_CATEGORY_TRANSLATION_KEYS: Record<string, string> = {
  'UserError': 'causeCategories.userError',
  'Infrastructure': 'causeCategories.infrastructure',
  'Bug': 'causeCategories.bug',
  'Configuration': 'causeCategories.configuration',
  'Performance': 'causeCategories.performance',
  'Security': 'causeCategories.security',
  'Network': 'causeCategories.network',
  'Database': 'causeCategories.database',
  'ThirdParty': 'causeCategories.thirdParty',
  'Unknown': 'causeCategories.unknown',
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function formatPercentage(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

function translateCauseCategory(
  category: string,
  t: ReturnType<typeof useTranslations<'intelligence'>>
): string {
  const key = ROOT_CAUSE_CATEGORY_TRANSLATION_KEYS[category];
  if (key) {
    const translated = t(key);
    return translated === key ? category : translated;
  }
  return category;
}

// ─── Modal Opener ───────────────────────────────────────────────────────────
export function openIntelligenceModal(
  ticketId: number,
  ticketTitle: string,
  ticketCode: string,
  modalTitle?: string
) {
  const windowId = `${MODAL_ID}-${ticketId}`;

  useWindowStore.getState().open({
    id: windowId,
    title: modalTitle ?? `Orbit Intelligence — ${ticketTitle}`,
    icon: <Brain className="h-4 w-4" />,
    modal: true,
    width: 1020,
    height: 820,
    content: (
      <IntelligenceModalContent
        ticketId={ticketId}
        ticketTitle={ticketTitle}
        ticketCode={ticketCode}
        windowId={windowId}
      />
    ),
  });
}

// ─── Types ──────────────────────────────────────────────────────────────────
type TabKey = 'overview' | 'causes' | 'resolutions' | 'copilot';
type FeedbackState = Record<string, 'up' | 'down'>;

// ─── Analyzing State ────────────────────────────────────────────────────────
function AnalyzingState() {
  const t = useTranslations('intelligence');

  const steps = [
    { icon: Search, label: t('analyzingSteps.scanning'), delay: 0 },
    { icon: Activity, label: t('analyzingSteps.matching'), delay: 0.4 },
    { icon: Brain, label: t('analyzingSteps.reasoning'), delay: 0.8 },
    { icon: Lightbulb, label: t('analyzingSteps.generating'), delay: 1.2 },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-10" role="status" aria-label={t('analyzing')}>
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/20"
          animate={{
            scale: [1, 2.5, 1],
            opacity: [0.4, 0, 0.4],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-0 rounded-full bg-primary/10"
          animate={{
            scale: [1, 1.8, 1],
            opacity: [0.3, 0, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-primary/15 text-primary flex items-center justify-center ring-1 ring-primary/20 shadow-lg shadow-primary/10">
          <Brain className="h-8 w-8" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-center"
      >
        <p className="text-base font-semibold text-text">{t('analyzing')}</p>
        <p className="text-xs text-muted mt-1.5">{t('analyzingHint')}</p>
      </motion.div>

      <div className="flex flex-col gap-2 w-64">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: step.delay, duration: 0.4 }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-panel/50 border border-border/50"
          >
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, delay: step.delay }}
              className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0"
            >
              <step.icon className="h-4 w-4" />
            </motion.div>
            <span className="text-xs font-medium text-text">{step.label}</span>
          </motion.div>
        ))}
      </div>

      <div className="w-56 h-1.5 bg-border/20 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary/40 via-primary/60 to-primary/40 rounded-full"
          animate={{ x: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '40%' }}
        />
      </div>
    </div>
  );
}

// ─── Empty State ────────────────────────────────────────────────────────────
function EmptyState() {
  const t = useTranslations('intelligence');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center"
    >
      <div className="w-20 h-20 rounded-3xl bg-primary/5 flex items-center justify-center">
        <Brain className="h-10 w-10 text-primary/25" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text">{t('noData')}</p>
        <p className="text-xs text-muted max-w-xs leading-relaxed">{t('noDataHint')}</p>
      </div>
    </motion.div>
  );
}

// ─── Error State ────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('intelligence');

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-1 flex-col items-center justify-center gap-6 p-10 text-center"
      role="alert"
    >
      <div className="w-20 h-20 rounded-3xl bg-danger/10 flex items-center justify-center ring-1 ring-danger/20">
        <AlertTriangle className="h-10 w-10 text-danger/60" />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-text">{t('analysisError')}</p>
        <p className="text-xs text-muted max-w-xs leading-relaxed">{t('analysisErrorHint')}</p>
      </div>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        {t('retry')}
      </Button>
    </motion.div>
  );
}

// ─── Cause Card ─────────────────────────────────────────────────────────────
function CauseCard({
  cause,
  index,
  t,
  windowId,
}: {
  cause: RootCauseCandidate;
  index: number;
  t: ReturnType<typeof useTranslations<'intelligence'>>;
  windowId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const translatedCategory = translateCauseCategory(cause.category, t);

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER_DELAY, duration: 0.35 }}
      className={cn(
        'rounded-xl border transition-all duration-300',
        expanded
          ? 'border-primary/30 bg-panel shadow-sm'
          : 'border-border bg-panel hover:border-primary/20 hover:shadow-sm'
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full p-4 text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold ring-1 ring-primary/20">
            {index + 1}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-[13px] font-semibold text-text">
                {translatedCategory}
              </h4>
              {cause.aiEnhanced && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 text-[9px] font-bold text-primary">
                  <Sparkles className="h-2.5 w-2.5" />
                  AI
                </span>
              )}
            </div>
            {cause.description && (
              <p className={cn(
                'text-[11px] text-muted leading-relaxed mt-1',
                !expanded && 'line-clamp-2'
              )}>
                {cause.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[11px] font-bold tabular-nums">
                {formatPercentage(cause.confidenceScore)}
              </span>
            </div>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-dim"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.div>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {cause.coOccurrencePatterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cause.coOccurrencePatterns.map((pattern) => (
                    <span
                      key={pattern}
                      className="px-2 py-0.5 rounded-md bg-warning/10 text-[10px] font-medium text-warning border border-warning/10"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              )}

              {cause.supportingTicketIds.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    openRelatedTicketsModal(
                      cause.supportingTicketIds,
                      t('relatedTicketsTitle'),
                      windowId
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/5 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  <Layers className="h-3 w-3" />
                  {t('viewSimilarTickets', { count: cause.supportingTicketIds.length })}
                  <ArrowUpRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

// ─── Resolution Card ────────────────────────────────────────────────────────
function ResolutionCard({
  resolution,
  index,
  feedback,
  onFeedback,
  onApply,
  isApplying,
  t,
  windowId,
}: {
  resolution: ResolutionSuggestion;
  index: number;
  feedback: FeedbackState;
  onFeedback: (id: number, accepted: boolean) => void;
  onApply: (resolution: ResolutionSuggestion) => void;
  isApplying: boolean;
  t: ReturnType<typeof useTranslations<'intelligence'>>;
  windowId: string;
}) {
  const key = String(resolution.resolutionId ?? index);
  const currentFeedback = feedback[key];
  const hasSuccessRate = resolution.successRate != null && !isNaN(resolution.successRate);
  const hasSimilarityScore = resolution.similarityScore != null && !isNaN(resolution.similarityScore);

  const handleSourceClick = () => {
    if (resolution.ticketId != null) {
      const store = useWindowStore.getState();
      store.close(windowId);

      setTimeout(() => {
        openTicketTab({
          id: resolution.ticketId,
          number: resolution.ticketNumber ?? String(resolution.ticketId),
        });
      }, 150);
    }
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER_DELAY, duration: 0.35 }}
      className="group rounded-xl border border-border bg-panel hover:border-success/20 hover:shadow-sm transition-all duration-300"
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-success/10 text-success flex items-center justify-center ring-1 ring-success/20">
              <Zap className="h-4 w-4" />
            </div>
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success text-[9px] font-bold text-white flex items-center justify-center shadow-sm">
              {index + 1}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-text leading-snug">
              {resolution.summary}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {hasSuccessRate && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-success/8 border border-success/10">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-[11px] font-bold text-success tabular-nums">
                {formatPercentage(resolution.successRate)}
              </span>
              <span className="text-[10px] text-success/60 font-medium">{t('successRate')}</span>
            </div>
          )}

          {hasSimilarityScore && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/8 border border-primary/10">
              <GitMerge className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-bold text-primary tabular-nums">
                {formatPercentage(resolution.similarityScore)}
              </span>
              <span className="text-[10px] text-primary/60 font-medium">{t('match')}</span>
            </div>
          )}

          {resolution.reusedCount > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-panel-2 border border-border/50">
              <RefreshCw className="h-3 w-3 text-dim" />
              <span className="text-[11px] font-semibold text-dim tabular-nums">
                {resolution.reusedCount}×
              </span>
              <span className="text-[10px] text-dim font-medium">{t('reuse')}</span>
            </div>
          )}
        </div>

        {(resolution.matchedTerms ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-0">
            {(resolution.matchedTerms ?? []).slice(0, 6).map((term) => (
              <span
                key={term}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 text-[10px] font-medium text-primary border border-primary/10"
              >
                <Tag className="h-2.5 w-2.5" />
                {term}
              </span>
            ))}
          </div>
        )}

        {resolution.ticketNumber != null && (
          <button
            type="button"
            onClick={handleSourceClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-panel-2/80 text-[11px] font-medium text-primary hover:bg-primary/5 transition-colors mt-3"
          >
            <FileText className="h-3 w-3" />
            {t('sourceTicket')} #{resolution.ticketNumber}
            <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-panel/30 rounded-b-xl">
        <Button
          size="sm"
          className="gap-1.5 shadow-sm text-[12px] h-8"
          loading={isApplying}
          onClick={() => onApply(resolution)}
        >
          <Play className="h-3 w-3" />
          {t('applySolution')}
        </Button>

        {resolution.resolutionId != null && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-dim font-medium">{t('wasHelpful')}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onFeedback(resolution.resolutionId, true)}
                className={cn(
                  'w-7 h-7 rounded-md border flex items-center justify-center transition-all duration-200',
                  currentFeedback === 'up'
                    ? 'border-success/40 bg-success/10 text-success shadow-sm'
                    : 'border-border/60 text-muted hover:border-success/30 hover:bg-success/5 hover:text-success'
                )}
                disabled={!!currentFeedback}
                aria-label={t('helpfulYes')}
              >
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onFeedback(resolution.resolutionId, false)}
                className={cn(
                  'w-7 h-7 rounded-md border flex items-center justify-center transition-all duration-200',
                  currentFeedback === 'down'
                    ? 'border-danger/40 bg-danger/10 text-danger shadow-sm'
                    : 'border-border/60 text-muted hover:border-danger/30 hover:bg-danger/5 hover:text-danger'
                )}
                disabled={!!currentFeedback}
                aria-label={t('helpfulNo')}
              >
                <ThumbsDown className="h-3 w-3" />
              </button>
            </div>
          </div>
        )}
      </div>
    </motion.article>
  );
}

// ─── Knowledge Card ─────────────────────────────────────────────────────────
function KnowledgeCard({
  knowledge,
  index,
}: {
  knowledge: KnowledgeSuggestion;
  index: number;
}) {
  return (
    <motion.article
      key={knowledge.assetId}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * STAGGER_DELAY, duration: 0.35 }}
      className="group rounded-xl border border-border bg-panel hover:border-warning/20 hover:shadow-sm transition-all duration-300 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center ring-1 ring-warning/20">
          <BookOpen className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-[13px] font-semibold text-text group-hover:text-primary transition-colors">
              {knowledge.title}
            </h4>
            {knowledge.category && (
              <span className="px-1.5 py-0.5 rounded-md bg-primary/5 text-[10px] font-medium text-primary border border-primary/10">
                {knowledge.category}
              </span>
            )}
          </div>

          {knowledge.summary && (
            <p className="text-[11px] text-muted leading-relaxed line-clamp-2 mt-0.5">
              {knowledge.summary}
            </p>
          )}

          {knowledge.matchedTerms.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {knowledge.matchedTerms.slice(0, 5).map((term) => (
                <span
                  key={term}
                  className="px-2 py-0.5 rounded-md bg-primary/5 text-[10px] font-medium text-primary border border-primary/10"
                >
                  {term}
                </span>
              ))}
            </div>
          )}
        </div>

        <ChevronRight className="h-4 w-4 text-dim group-hover:text-warning transition-colors flex-shrink-0 mt-2.5" />
      </div>
    </motion.article>
  );
}

// ─── Related Tickets Preview ────────────────────────────────────────────────
function RelatedTicketsPreview({
  ticketIds,
  windowId,
}: {
  ticketIds: number[];
  windowId: string;
}) {
  const t = useTranslations('intelligence');

  const ticketQueries = useQueries({
    queries: ticketIds.map((ticketId) => ({
      queryKey: ['tickets', 'detail', ticketId],
      queryFn: () => ticketsApi.get(ticketId),
      retry: false as const,
    })),
  });

  const handleTicketClick = (ticket: { id: number; number: string; title: string }) => {
    const store = useWindowStore.getState();
    const relatedModalId = `related-tickets-${ticketIds.join('-')}`;
    store.close(relatedModalId);
    store.close(windowId);

    setTimeout(() => {
      openTicketTab({ id: ticket.id, number: ticket.number, title: ticket.title });
    }, 150);
  };

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* Count badge */}
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-[10px] text-dim font-medium">
          {t('relatedCount', { count: ticketIds.length })}
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {ticketQueries.map((query, index) => {
          const ticketId = ticketIds[index];

          if (query.isLoading) {
            return (
              <div
                key={ticketId}
                className="animate-pulse rounded-lg bg-panel-2/50 h-[52px]"
              />
            );
          }

          if (query.isError || !query.data) {
            return (
              <div
                key={ticketId}
                className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2.5 text-[11px] text-danger flex items-center gap-2"
              >
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                #{ticketId} — {t('ticketLoadError')}
              </div>
            );
          }

          const ticket = query.data;
          return (
            <button
              key={ticketId}
              type="button"
              onClick={() => handleTicketClick(ticket)}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel px-3 py-2.5 hover:border-primary/30 hover:shadow-sm transition-all text-left w-full group"
            >
              <span className="flex-shrink-0 text-xs font-bold text-primary tabular-nums">
                #{ticket.number}
              </span>
              <span className="flex-1 text-[13px] text-text truncate">
                {ticket.title}
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 flex-shrink-0 text-dim group-hover:text-primary transition-colors" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function openRelatedTicketsModal(ticketIds: number[], title?: string, windowId?: string) {
  useWindowStore.getState().open({
    id: `related-tickets-${ticketIds.join('-')}`,
    title: title ?? 'Tickets relacionados',
    icon: <Layers className="h-4 w-4" />,
    modal: true,
    width: 460,
    height: 400,
    content: (
      <RelatedTicketsPreview ticketIds={ticketIds} windowId={windowId ?? ''} />
    ),
  });
}

// ─── Main Content Component ─────────────────────────────────────────────────
function IntelligenceModalContent({
  ticketId,
  ticketTitle,
  ticketCode,
  windowId,
}: {
  ticketId: number;
  ticketTitle: string;
  ticketCode: string;
  windowId: string;
}) {
  const t = useTranslations('intelligence');
  const queryClient = useQueryClient();

  const [feedback, setFeedback] = useState<FeedbackState>({});
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const report = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
    retry: false,
  });

  const applyResolution = useMutation({
    mutationFn: (resolution: { resolutionId: number; summary: string }) =>
      ticketResolutionApi.resolveWithAi(ticketId, {
        rootCauseId: 0,
        summary: resolution.summary,
        resolutionSteps: '',
        notifyCustomer: true,
      }),
    onSuccess: () => {
      toast.success(t('appliedSuccess'));
      queryClient.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('applyError'))),
  });

  const sendFeedback = useMutation({
    mutationFn: (fb: { resolutionId: number; accepted: boolean }) =>
      ticketsApi.recommendationFeedback(ticketId, {
        resolutionId: fb.resolutionId,
        accepted: fb.accepted,
        helpful: fb.accepted,
      }),
    onSuccess: (_data, variables) => {
      setFeedback((prev) => ({
        ...prev,
        [variables.resolutionId]: variables.accepted ? 'up' : 'down',
      }));
      toast.success(t('feedbackSent'));
    },
    onError: (error) => toast.error(apiErrorMessage(error, t('feedbackError'))),
  });

  if (report.isLoading) return <AnalyzingState />;
  if (report.isError) return <ErrorState onRetry={() => report.refetch()} />;

  const causes = report.data?.rootCauseCandidates ?? [];
  const resolutions = report.data?.resolutionSuggestions ?? [];

  const handleApplyResolution = (resolution: ResolutionSuggestion) => {
    applyResolution.mutate({
      resolutionId: resolution.resolutionId,
      summary: resolution.summary,
    });
  };

  const handleFeedback = (resolutionId: number, accepted: boolean) => {
    sendFeedback.mutate({ resolutionId, accepted });
  };

  const handleClose = () => {
    useWindowStore.getState().close(windowId);
  };

  const tabs = [
    {
      key: 'overview' as TabKey,
      icon: LayoutDashboard,
      label: t('summary'),
    },
    {
      key: 'causes' as TabKey,
      icon: Target,
      label: t('rootCauses'),
      count: causes.length,
      color: 'primary' as const,
    },
    {
      key: 'resolutions' as TabKey,
      icon: Lightbulb,
      label: t('resolutions'),
      count: resolutions.length,
      color: 'success' as const,
    },
    {
      key: 'copilot' as TabKey,
      icon: Sparkles,
      label: t('copilotTab'),
    },
  ];

  const summaryCards = [
    {
      icon: Target,
      label: t('rootCauses'),
      count: causes.length,
      color: 'text-primary',
      bg: 'bg-primary/10',
      ring: 'ring-primary/20',
      border: 'border-primary/20',
    },
    {
      icon: Lightbulb,
      label: t('resolutions'),
      count: resolutions.length,
      color: 'text-success',
      bg: 'bg-success/10',
      ring: 'ring-success/20',
      border: 'border-success/20',
    },
  ];

  const topResolution = resolutions[0];
  const topCause = causes[0];
  const hasQuickNav = causes.length > 1 || resolutions.length > 1;

  return (
    <div className="flex flex-col h-full bg-bg">
      {/* ─── TABS ────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex gap-1 overflow-x-auto border-b border-border px-6" role="tablist">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isResolutions = tab.key === 'resolutions';

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'border-primary text-primary bg-panel'
                  : 'border-transparent text-muted hover:text-text'
              )}
            >
              <tab.icon
                className={cn(
                  'h-4 w-4 transition-colors',
                  isActive && isResolutions && 'text-success',
                )}
              />
              <span>{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span
                  className={cn(
                    'ml-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums transition-colors',
                    isActive && isResolutions && 'bg-success/10 text-success',
                    isActive && !isResolutions && 'bg-primary/10 text-primary',
                    !isActive && 'bg-border/30 text-dim'
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── CONTENT ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {summaryCards.map((card, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08, duration: 0.4 }}
                      className={cn(
                        'flex items-center gap-3 rounded-xl border p-3.5 bg-panel transition-all hover:shadow-sm',
                        card.border
                      )}
                    >
                      <div className={cn(
                        'flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ring-1',
                        card.bg, card.color, card.ring
                      )}>
                        <card.icon className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <p className="text-xl font-bold text-text tabular-nums leading-none">
                          {card.count}
                        </p>
                        <p className="text-[11px] font-medium text-dim truncate leading-none">
                          {card.label}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {topResolution && (
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2, duration: 0.4 }}
                      className="rounded-xl border border-success/20 bg-gradient-to-br from-success/[0.04] to-transparent p-4"
                    >
                      <div className="flex items-start gap-2.5 mb-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-success/10 text-success flex items-center justify-center ring-1 ring-success/20">
                          <Zap className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-success/70">
                            {t('suggestedSolution')}
                          </p>
                          <p className="text-[10px] text-dim">#1 {t('recommendation')}</p>
                        </div>
                        {topResolution.successRate != null && (
                          <span className="flex-shrink-0 text-[13px] font-bold text-success tabular-nums">
                            {formatPercentage(topResolution.successRate)}
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] font-semibold text-text leading-relaxed mb-3">
                        {topResolution.summary}
                      </p>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          className="gap-1.5 text-[11px] h-7"
                          loading={applyResolution.isPending}
                          onClick={() => handleApplyResolution(topResolution)}
                        >
                          <Play className="h-3 w-3" />
                          {t('applySolution')}
                        </Button>
                        {topResolution.reusedCount > 0 && (
                          <span className="text-[10px] text-dim">
                            {t('reusedCount', { count: topResolution.reusedCount })}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}

                  {topCause && (
                    <motion.div
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25, duration: 0.4 }}
                      className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/[0.04] to-transparent p-4"
                    >
                      <div className="flex items-start gap-2.5 mb-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                          <Target className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">
                            {t('probableCause')}
                          </p>
                          <p className="text-[10px] text-dim">#1 {t('cause')}</p>
                        </div>
                        <span className="flex-shrink-0 text-[13px] font-bold text-primary tabular-nums">
                          {formatPercentage(topCause.confidenceScore)}
                        </span>
                      </div>

                      <p className="text-[13px] font-semibold text-text mb-2">
                        {translateCauseCategory(topCause.category, t)}
                      </p>

                      {topCause.description && (
                        <p className="text-[11px] text-muted leading-relaxed mb-3 line-clamp-2">
                          {topCause.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1">
                          {topCause.coOccurrencePatterns.slice(0, 3).map((pattern) => (
                            <span
                              key={pattern}
                              className="px-1.5 py-0.5 rounded-md bg-warning/10 text-[9px] font-medium text-warning border border-warning/10"
                            >
                              {pattern}
                            </span>
                          ))}
                        </div>
                        {topCause.supportingTicketIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              openRelatedTicketsModal(
                                topCause.supportingTicketIds,
                                t('relatedTicketsTitle'),
                                windowId
                              )
                            }
                            className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline flex-shrink-0"
                          >
                            <Layers className="h-2.5 w-2.5" />
                            {t('viewTickets')}
                            <ChevronRight className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {hasQuickNav && (
                <div className="flex-shrink-0 grid grid-cols-2 gap-3 px-5 pb-5 pt-0">
                  {causes.length > 1 && (
                    <motion.button
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.35, duration: 0.4 }}
                      type="button"
                      onClick={() => setActiveTab('causes')}
                      className="group flex items-center justify-between rounded-xl border border-border bg-panel p-3.5 text-left hover:border-primary/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
                          <Target className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-text">{t('rootCauses')}</p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {t('viewAllCauses', { count: causes.length - 1 })}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-dim group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </motion.button>
                  )}

                  {resolutions.length > 1 && (
                    <motion.button
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.4 }}
                      type="button"
                      onClick={() => setActiveTab('resolutions')}
                      className="group flex items-center justify-between rounded-xl border border-border bg-panel p-3.5 text-left hover:border-success/30 hover:shadow-sm transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center ring-1 ring-success/20">
                          <Lightbulb className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[12px] font-semibold text-text">{t('resolutions')}</p>
                          <p className="text-[10px] text-muted mt-0.5">
                            {t('viewAllResolutions', { count: resolutions.length - 1 })}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-dim group-hover:text-success group-hover:translate-x-1 transition-all flex-shrink-0" />
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'causes' && (
            <motion.div
              key="causes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-5 space-y-2.5"
            >
              {causes.map((cause, index) => (
                <CauseCard
                  key={index}
                  cause={cause}
                  index={index}
                  t={t}
                  windowId={windowId}
                />
              ))}
              {causes.length === 0 && (
                <p className="py-12 text-center text-sm text-dim">{t('noCauses')}</p>
              )}
            </motion.div>
          )}

          {activeTab === 'resolutions' && (
            <motion.div
              key="resolutions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-5 space-y-3"
            >
              {resolutions.map((resolution, index) => (
                <ResolutionCard
                  key={resolution.resolutionId ?? index}
                  resolution={resolution}
                  index={index}
                  feedback={feedback}
                  onFeedback={handleFeedback}
                  onApply={handleApplyResolution}
                  isApplying={applyResolution.isPending}
                  t={t}
                  windowId={windowId}
                />
              ))}
              {resolutions.length === 0 && (
                <p className="py-12 text-center text-sm text-dim">{t('noResolutions')}</p>
              )}
            </motion.div>
          )}

          {activeTab === 'copilot' && (
            <motion.div
              key="copilot"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <CopilotView ticketId={ticketId} embedded />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-t border-border bg-bg-subtle/30">
        <span className="flex items-center gap-1.5 text-[10px] text-dim font-medium">
          <Brain className="h-3 w-3 text-primary" />
          {t('brandFooter')}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-dim font-medium">
          <Clock className="h-3 w-3" />
          {t('poweredBy')}
        </span>
      </footer>
    </div>
  );
}