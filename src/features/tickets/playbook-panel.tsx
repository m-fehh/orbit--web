'use client';

import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Route, ThumbsUp, ThumbsDown, Copy, Check, CheckCircle2, Zap, GitBranch,
  ChevronDown, ChevronRight, ClipboardCopy, Tag,
} from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { CONFIDENCE_TO_NUMBER } from '@/shared/api/types';
import type { PlaybookSuggestion, PlaybookStepView, RecommendedAction } from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

const CONFIDENCE_STYLE: Record<PlaybookSuggestion['confidence'], string> = {
  High: 'bg-success/15 text-success ring-success/20',
  Medium: 'bg-warning/15 text-warning ring-warning/20',
  Low: 'bg-panel-2 text-dim ring-border',
};

function StepIcon({ kind }: { kind: PlaybookStepView['kind'] }) {
  if (kind === 'Check') return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (kind === 'Decision') return <GitBranch className="h-3.5 w-3.5" />;
  return <Zap className="h-3.5 w-3.5" />;
}

const STEP_KIND_STYLE: Record<PlaybookStepView['kind'], string> = {
  Check: 'bg-primary/10 text-primary',
  Action: 'bg-success/10 text-success',
  Decision: 'bg-warning/10 text-warning',
};

/** Rascunho de resposta copiável (mostrado no modo GuideWithDraft). */
function ResolutionDraft({ template }: { template: string }) {
  const t = useTranslations('playbooks');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('copyError'));
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <ClipboardCopy className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">{t('draftTitle')}</span>
        <button
          type="button"
          onClick={copy}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-primary/15"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? t('copied') : t('copyDraft')}
        </button>
      </div>
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-text">{template}</p>
    </div>
  );
}

function PlaybookCard({
  playbook,
  ticketId,
  showDraft,
}: {
  playbook: PlaybookSuggestion;
  ticketId: number;
  showDraft: boolean;
}) {
  const t = useTranslations('playbooks');
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  const steps = useMemo(() => [...playbook.steps].sort((a, b) => a.order - b.order), [playbook.steps]);

  const sendFeedback = useMutation({
    mutationFn: (helpful: boolean) =>
      ticketsApi.recommendationFeedback(ticketId, {
        playbookId: playbook.playbookId,
        accepted: helpful,
        helpful,
        offeredConfidence: CONFIDENCE_TO_NUMBER[playbook.confidence],
      }),
    onSuccess: (_d, helpful) => {
      setFeedback(helpful ? 'up' : 'down');
      toast.success(t('feedbackSent'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('feedbackError'))),
  });

  const doneCount = steps.filter((s) => checked[s.order]).length;

  return (
    <div className="rounded-xl border border-border bg-panel p-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
          <Route className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text">{playbook.title}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold ring-1', CONFIDENCE_STYLE[playbook.confidence])}>
              {t(`confidence.${playbook.confidence}` as 'confidence.Low')}
            </span>
            {playbook.isDraft && (
              <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold text-warning ring-1 ring-warning/20" title={t('draftHint')}>
                {t('draftBadge')}
              </span>
            )}
            {playbook.isDecaying && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold text-danger ring-1 ring-danger/20" title={t('decayHint')}>
                {t('decayBadge')}
              </span>
            )}
          </div>
          {playbook.summary && <p className="mt-1 text-xs leading-relaxed text-muted">{playbook.summary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {playbook.successRate != null && !isNaN(playbook.successRate) && (
              <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">
                {pct(playbook.successRate)} {t('success')}
              </span>
            )}
            {playbook.appliedCount > 0 && (
              <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-dim">
                {t('appliedCount', { count: playbook.appliedCount })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Matched symptoms */}
      {playbook.matchedSymptoms.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Tag className="h-3 w-3 text-dim" />
          {playbook.matchedSymptoms.map((s) => (
            <span key={s} className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{s}</span>
          ))}
        </div>
      )}

      {/* Steps with check-off */}
      {steps.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-dim">{t('steps')}</span>
            <span className="text-[10px] tabular-nums text-dim">{doneCount}/{steps.length}</span>
          </div>
          <ol className="flex flex-col gap-1.5">
            {steps.map((step) => {
              const isChecked = !!checked[step.order];
              return (
                <li key={step.order}>
                  <button
                    type="button"
                    onClick={() => setChecked((c) => ({ ...c, [step.order]: !c[step.order] }))}
                    className={cn(
                      'flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                      isChecked ? 'border-success/30 bg-success/5' : 'border-border hover:border-primary/30',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
                        isChecked ? 'border-success bg-success text-white' : 'border-border text-transparent',
                      )}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded', STEP_KIND_STYLE[step.kind])}>
                          <StepIcon kind={step.kind} />
                        </span>
                        <span className="text-[9px] font-bold uppercase tracking-wide text-dim">{t(`kind.${step.kind}` as 'kind.Check')}</span>
                      </div>
                      <p className={cn('mt-1 text-xs leading-relaxed', isChecked ? 'text-dim line-through' : 'text-text')}>
                        {step.instruction}
                      </p>
                      {step.expectedSignal && (
                        <p className="mt-0.5 text-[10px] text-muted">
                          <span className="font-medium">{t('expectedSignal')}:</span> {step.expectedSignal}
                        </p>
                      )}
                      {step.kind === 'Decision' && (step.onYesOrder != null || step.onNoOrder != null) && (
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-dim">
                          {step.onYesOrder != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <ChevronRight className="h-3 w-3" /> {t('onYes', { order: step.onYesOrder })}
                            </span>
                          )}
                          {step.onNoOrder != null && (
                            <span className="inline-flex items-center gap-0.5">
                              <ChevronRight className="h-3 w-3" /> {t('onNo', { order: step.onNoOrder })}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Draft (GuideWithDraft) */}
      {showDraft && playbook.resolutionTemplate && <ResolutionDraft template={playbook.resolutionTemplate} />}

      {/* Feedback */}
      <div className="mt-3.5 flex items-center gap-2 border-t border-border/60 pt-3">
        <span className="text-[10px] text-dim">{t('wasHelpful')}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => sendFeedback.mutate(true)}
            disabled={!!feedback}
            aria-label={t('helpfulYes')}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-success/30 hover:bg-success/10 hover:text-success',
              feedback === 'up' && 'border-success/30 bg-success/15 text-success',
            )}
          >
            <ThumbsUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => sendFeedback.mutate(false)}
            disabled={!!feedback}
            aria-label={t('helpfulNo')}
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg border border-transparent text-muted transition-colors hover:border-danger/30 hover:bg-danger/10 hover:text-danger',
              feedback === 'down' && 'border-danger/30 bg-danger/15 text-danger',
            )}
          >
            <ThumbsDown className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Painel "Playbook de Resolução" — mostra o melhor roteiro de resolução sugerido pelo TaaS,
 * com passos check-off, sintomas casados, rascunho copiável (GuideWithDraft) e feedback.
 * Estado vazio honesto quando nenhum roteiro confiável foi casado.
 */
export function PlaybookPanel({
  ticketId,
  playbooks,
  recommendedAction,
}: {
  ticketId: number;
  playbooks: PlaybookSuggestion[] | null | undefined;
  recommendedAction?: RecommendedAction | null;
}) {
  const t = useTranslations('playbooks');
  const [showOthers, setShowOthers] = useState(false);

  const list = playbooks ?? [];
  const showDraft = recommendedAction === 'GuideWithDraft';

  const best = list[0];
  const rest = list.slice(1);

  return (
    <div className="card-surface overflow-hidden border border-primary/20">
      <div className="flex items-center gap-2 bg-gradient-to-r from-primary/8 to-transparent px-md py-2.5">
        <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/15">
          <Route className="h-3.5 w-3.5 text-primary" />
        </div>
        <p className="text-xs font-semibold text-primary">{t('title')}</p>
        {list.length > 0 && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">{list.length}</span>
        )}
      </div>

      <div className="p-md">
        {!best ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="rounded-2xl bg-primary/5 p-4">
              <Route className="h-8 w-8 text-primary/30" />
            </div>
            <p className="max-w-sm text-xs leading-relaxed text-muted">{t('empty')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <PlaybookCard playbook={best} ticketId={ticketId} showDraft={showDraft} />

            {rest.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setShowOthers((v) => !v)}
                  className="inline-flex items-center gap-1.5 self-start text-[11px] font-medium text-primary hover:underline"
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showOthers && 'rotate-180')} />
                  {t('otherPlaybooks', { count: rest.length })}
                </button>
                <AnimatePresence initial={false}>
                  {showOthers && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col gap-3 overflow-hidden"
                    >
                      {rest.map((p) => (
                        <PlaybookCard key={p.playbookId} playbook={p} ticketId={ticketId} showDraft={showDraft} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
