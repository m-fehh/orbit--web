'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Brain, ThumbsUp, ThumbsDown, Check, Loader2, BookOpen, Target, Lightbulb, Sparkles,
} from 'lucide-react';
import { intelligenceApi, knowledgeApi, ticketsApi, resolutionsApi } from '@/shared/api/endpoints';
import { ticketResolutionApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const MODAL_ID = 'intelligence-modal';

/** Opens the Intelligence Assistant modal via the floating window system. */
export function openIntelligenceModal(ticketId: number, ticketTitle: string) {
  useWindowStore.getState().open({
    id: `${MODAL_ID}-${ticketId}`,
    title: '',  // title rendered inside content
    icon: <Brain className="h-4 w-4" />,
    modal: true,
    width: 480,
    height: 640,
    content: <IntelligenceModalContent ticketId={ticketId} ticketTitle={ticketTitle} />,
  });
}

type FeedbackState = Record<string, 'up' | 'down'>;

function IntelligenceModalContent({ ticketId, ticketTitle }: { ticketId: number; ticketTitle: string }) {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<FeedbackState>({});

  // --- Data fetching ---
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

  // --- Mutations ---
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

  if (isLoading) return <LoadingState label={t('analyzing')} />;
  if (isError) return <ErrorState title={t('analysisError')} onRetry={() => { rootCauses.refetch(); resolutions.refetch(); }} retryLabel={t('retry')} />;

  const rcData = rootCauses.data ?? [];
  const resData = resolutions.data ?? [];
  const knData = knowledge.data?.items ?? [];

  const hasNoData = rcData.length === 0 && resData.length === 0 && knData.length === 0;

  if (hasNoData) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-lg text-dim">
        <Brain className="h-12 w-12 opacity-50" />
        <p className="text-sm font-medium">{t('noData')}</p>
        <p className="text-xs">{t('noDataHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-0 overflow-y-auto">
      {/* Disclaimer */}
      <div className="border-b border-border bg-warning/5 px-md py-2 text-center text-[11px] text-muted">
        <Sparkles className="mr-1 inline h-3 w-3 text-primary" />
        {t('aiDisclaimer')}
      </div>

      {/* Section 1: Root Cause Suggestions */}
      {rcData.length > 0 && (
        <section className="border-b border-border p-md">
          <h3 className="mb-sm flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
            <Target className="h-3.5 w-3.5 text-primary" />
            {t('rootCauses')}
          </h3>
          <div className="flex flex-col gap-sm">
            {rcData.map((rc, i) => (
              <div key={i} className="rounded-md border border-border bg-bg-subtle/50 p-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text">{rc.title || rc.category}</p>
                    <p className="mt-0.5 text-xs text-muted line-clamp-2">{rc.reasoning}</p>
                  </div>
                  <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-xs font-bold text-primary">
                    {Math.round(rc.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Resolution Suggestions */}
      {resData.length > 0 && (
        <section className="border-b border-border p-md">
          <h3 className="mb-sm flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
            <Lightbulb className="h-3.5 w-3.5 text-success" />
            {t('resolutions')}
          </h3>
          <div className="flex flex-col gap-sm">
            {resData.map((r, i) => {
              const key = String(r.resolutionId ?? i);
              const fb = feedback[key];
              return (
                <div key={key} className="rounded-md border border-border bg-bg-subtle/50 p-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-text">{r.summary}</p>
                      {r.steps && <p className="mt-0.5 text-xs text-muted line-clamp-2">{r.steps}</p>}
                    </div>
                    <span className="shrink-0 rounded bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success">
                      {Math.round(r.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-sm flex items-center gap-1.5">
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
                          className={cn('grid h-7 w-7 place-items-center rounded text-muted hover:bg-success/10 hover:text-success', fb === 'up' && 'bg-success/15 text-success')}
                          disabled={!!fb}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => sendFeedback.mutate({ resolutionId: r.resolutionId!, accepted: false })}
                          className={cn('grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger/10 hover:text-danger', fb === 'down' && 'bg-danger/15 text-danger')}
                          disabled={!!fb}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 3: Related Knowledge */}
      {knData.length > 0 && (
        <section className="p-md">
          <h3 className="mb-sm flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
            <BookOpen className="h-3.5 w-3.5 text-warning" />
            {t('relatedKnowledge')}
          </h3>
          <div className="flex flex-col gap-sm">
            {knData.map((k) => (
              <div key={k.id} className="rounded-md border border-border bg-bg-subtle/50 p-sm">
                <p className="text-sm font-medium text-text">{k.title}</p>
                {k.summary && <p className="mt-0.5 text-xs text-muted line-clamp-2">{k.summary}</p>}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
