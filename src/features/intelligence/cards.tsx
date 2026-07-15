'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, TrendingUp, ChevronRight, Layers, ArrowUpRight, Zap, GitMerge,
  RefreshCw, Tag, FileText, Play, ThumbsUp, ThumbsDown,
} from 'lucide-react';
import type { RootCauseCandidate, ResolutionSuggestion, IntakeDuplicate } from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

/**
 * Biblioteca ÚNICA de cards de inteligência (causa raiz, solução sugerida, duplicata).
 * Fonte única de verdade para TODAS as telas (assistente do ticket, painel Orbit Intelligence,
 * modal de resolver, copiloto, radar de problemas, base de soluções) — para o layout ser
 * consistente em todo lugar. Ações são opcionais (callbacks); sem elas o card é só leitura.
 */

// ─── Helpers de tradução/formatação ──────────────────────────────────────────

const CAUSE_CATEGORY_KEYS: Record<string, string> = {
  UserError: 'causeCategories.userError',
  Infrastructure: 'causeCategories.infrastructure',
  Bug: 'causeCategories.bug',
  Configuration: 'causeCategories.configuration',
  Performance: 'causeCategories.performance',
  Security: 'causeCategories.security',
  Network: 'causeCategories.network',
  Database: 'causeCategories.database',
  ThirdParty: 'causeCategories.thirdParty',
  Data: 'causeCategories.data',
  Process: 'causeCategories.process',
  External: 'causeCategories.external',
  Human: 'causeCategories.human',
  Code: 'causeCategories.code',
  Unknown: 'causeCategories.unknown',
};

/** Traduz a categoria de causa raiz (enum do servidor) via namespace `intelligence`. */
export function translateCauseCategory(
  category: string,
  t: ReturnType<typeof useTranslations<'intelligence'>>,
): string {
  const key = CAUSE_CATEGORY_KEYS[category];
  if (!key) return category;
  const translated = t(key as 'causeCategories.bug');
  return translated === key ? category : translated;
}

/** 0..1 → "NN%". */
export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value * 100)}%`;
}

// ─── Card: Causa Raiz ─────────────────────────────────────────────────────────

export function RootCauseCard({
  cause,
  index = 0,
  onViewTickets,
}: {
  cause: RootCauseCandidate;
  index?: number;
  onViewTickets?: (ticketIds: number[]) => void;
}) {
  const t = useTranslations('intelligence');
  const [expanded, setExpanded] = useState(false);
  const category = translateCauseCategory(cause.category, t);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className={cn(
        'rounded-xl border bg-panel transition-all',
        expanded ? 'border-primary/30 shadow-sm' : 'border-border hover:border-primary/20 hover:shadow-sm',
      )}
    >
      <button type="button" onClick={() => setExpanded((v) => !v)} className="w-full p-4 text-left" aria-expanded={expanded}>
        <div className="flex items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[13px] font-semibold text-text">{category}</h4>
              {cause.aiEnhanced && (
                <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                  <Sparkles className="h-2.5 w-2.5" /> {t('aiBadge')}
                </span>
              )}
            </div>
            {cause.description && (
              <p className={cn('mt-1 text-[11px] leading-relaxed text-muted', !expanded && 'line-clamp-2')}>{cause.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-primary">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[11px] font-bold tabular-nums">{formatPct(cause.confidenceScore)}</span>
            </span>
            <motion.span animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-dim">
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.span>
          </div>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              {cause.coOccurrencePatterns.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {cause.coOccurrencePatterns.map((p) => (
                    <span key={p} className="rounded-md border border-warning/10 bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{p}</span>
                  ))}
                </div>
              )}
              {cause.supportingTicketIds.length > 0 && onViewTickets && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onViewTickets(cause.supportingTicketIds); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
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

// ─── Card: Solução Sugerida (resolução similar) ───────────────────────────────

export function ResolutionSuggestionCard({
  resolution,
  index = 0,
  feedback,
  onFeedback,
  onApply,
  isApplying,
  onOpenSource,
}: {
  resolution: ResolutionSuggestion;
  index?: number;
  feedback?: 'up' | 'down';
  onFeedback?: (resolutionId: number, accepted: boolean) => void;
  onApply?: (resolution: ResolutionSuggestion) => void;
  isApplying?: boolean;
  onOpenSource?: (resolution: ResolutionSuggestion) => void;
}) {
  const t = useTranslations('intelligence');
  const hasSuccess = resolution.successRate != null && !Number.isNaN(resolution.successRate);
  const hasMatch = resolution.similarityScore != null && !Number.isNaN(resolution.similarityScore);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      className="group rounded-xl border border-border bg-panel transition-all hover:border-success/20 hover:shadow-sm"
    >
      <div className="p-4">
        <div className="mb-3 flex items-start gap-3">
          <div className="relative shrink-0">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-success/10 text-success ring-1 ring-success/20"><Zap className="h-4 w-4" /></span>
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-success text-[9px] font-bold text-white shadow-sm">{index + 1}</span>
          </div>
          <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-text">{resolution.summary}</p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {hasSuccess && (
            <span className="inline-flex items-center gap-1 rounded-md border border-success/10 bg-success/[0.08] px-2 py-1">
              <TrendingUp className="h-3 w-3 text-success" />
              <span className="text-[11px] font-bold tabular-nums text-success">{formatPct(resolution.successRate)}</span>
              <span className="text-[10px] font-medium text-success/60">{t('successRate')}</span>
            </span>
          )}
          {hasMatch && (
            <span className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/[0.08] px-2 py-1">
              <GitMerge className="h-3 w-3 text-primary" />
              <span className="text-[11px] font-bold tabular-nums text-primary">{formatPct(resolution.similarityScore)}</span>
              <span className="text-[10px] font-medium text-primary/60">{t('match')}</span>
            </span>
          )}
          {resolution.reusedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-panel-2 px-2 py-1">
              <RefreshCw className="h-3 w-3 text-dim" />
              <span className="text-[11px] font-semibold tabular-nums text-dim">{resolution.reusedCount}×</span>
              <span className="text-[10px] font-medium text-dim">{t('reuse')}</span>
            </span>
          )}
        </div>

        {(resolution.matchedTerms ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(resolution.matchedTerms ?? []).slice(0, 6).map((term) => (
              <span key={term} className="inline-flex items-center gap-1 rounded-md border border-primary/10 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary">
                <Tag className="h-2.5 w-2.5" /> {term}
              </span>
            ))}
          </div>
        )}

        {resolution.ticketNumber != null && onOpenSource && (
          <button
            type="button"
            onClick={() => onOpenSource(resolution)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-panel-2/80 px-2.5 py-1.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <FileText className="h-3 w-3" /> {t('sourceTicket')} #{resolution.ticketNumber}
            <ArrowUpRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {(onApply || (onFeedback && resolution.resolutionId != null)) && (
        <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-panel/30 px-4 py-3">
          {onApply ? (
            <Button size="sm" className="h-8 gap-1.5 text-[12px] shadow-sm" loading={isApplying} onClick={() => onApply(resolution)}>
              <Play className="h-3 w-3" /> {t('applySolution')}
            </Button>
          ) : <span />}

          {onFeedback && resolution.resolutionId != null && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-dim">{t('wasHelpful')}</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onFeedback(resolution.resolutionId, true)}
                  disabled={!!feedback}
                  aria-label={t('helpfulYes')}
                  className={cn('grid h-7 w-7 place-items-center rounded-md border transition-all',
                    feedback === 'up' ? 'border-success/40 bg-success/10 text-success shadow-sm' : 'border-border/60 text-muted hover:border-success/30 hover:bg-success/5 hover:text-success')}
                >
                  <ThumbsUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onFeedback(resolution.resolutionId, false)}
                  disabled={!!feedback}
                  aria-label={t('helpfulNo')}
                  className={cn('grid h-7 w-7 place-items-center rounded-md border transition-all',
                    feedback === 'down' ? 'border-danger/40 bg-danger/10 text-danger shadow-sm' : 'border-border/60 text-muted hover:border-danger/30 hover:bg-danger/5 hover:text-danger')}
                >
                  <ThumbsDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.article>
  );
}

// ─── Card: Duplicata provável ─────────────────────────────────────────────────

export function DuplicateCard({ dup, onOpen }: { dup: IntakeDuplicate; onOpen?: (dup: IntakeDuplicate) => void }) {
  const tStatus = useTranslations('ticketStatus');
  const statusLabel = tStatus.has(dup.status as 'New') ? tStatus(dup.status as 'New') : dup.status;
  const Wrapper = onOpen ? 'button' : 'div';
  return (
    <Wrapper
      {...(onOpen ? { type: 'button' as const, onClick: () => onOpen(dup) } : {})}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border border-border bg-panel p-3 text-left transition-all',
        onOpen && 'hover:border-primary/30 hover:shadow-sm',
      )}
    >
      <span className="shrink-0 font-mono text-xs font-semibold text-primary">#{dup.number}</span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text">{dup.title}</span>
      <span className="shrink-0 rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-dim">{statusLabel}</span>
      <span className="shrink-0 rounded-md bg-warning/10 px-2 py-0.5 text-[10px] font-bold tabular-nums text-warning">{formatPct(dup.score)}</span>
      {onOpen && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-dim" />}
    </Wrapper>
  );
}
