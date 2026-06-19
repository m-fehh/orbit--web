'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { Loader2 } from 'lucide-react';
import { investigationsApi, ticketResolutionApi } from '@/shared/api/endpoints';

interface IntelligencePanelProps {
  ticketId: number;
  ticketStatus: string;
}

interface RootCauseCandidate {
  rootCauseId: number;
  title: string;
  confidence: number;
  frequency: number;
}

interface ResolutionSuggestion {
  rootCauseId: number;
  summary: string;
  resolutionSteps: string;
  successRate: number;
  appliedCount: number;
}

export function IntelligencePanel({ ticketId, ticketStatus }: IntelligencePanelProps) {
  const t = useTranslations();
  const queryClient = useQueryClient();
  const [selectedRootCause, setSelectedRootCause] = useState<RootCauseCandidate | null>(null);
  const [selectedResolution, setSelectedResolution] = useState<ResolutionSuggestion | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch intelligence report
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['intelligence', ticketId],
    queryFn: () => investigationsApi.getTicketIntelligence(ticketId),
  });

  // Mutation to resolve with AI
  const resolveWithAiMutation = useMutation({
    mutationFn: async () => {
      if (!selectedResolution || !selectedRootCause) {
        throw new Error('Missing resolution or root cause');
      }

      return ticketResolutionApi.resolveWithAi(ticketId, {
        rootCauseId: selectedRootCause.rootCauseId,
        summary: selectedResolution.summary,
        resolutionSteps: selectedResolution.resolutionSteps,
        notifyCustomer: true,
      });
    },
    onSuccess: () => {
      toast.success(t('tickets.resolvedWithAi'));
      setShowConfirmation(false);
      setSelectedResolution(null);
      setSelectedRootCause(null);

      // Invalidate ticket queries to refresh
      queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => {
      toast.error(t('error.resolvingTicket'));
      console.error('Resolution error:', error);
    },
  });

  const isResolved = ticketStatus === 'Resolved' || ticketStatus === 'Closed';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 bg-destructive/10">
        <p className="text-destructive">{t('error.loadingIntelligence')}</p>
      </Card>
    );
  }

  if (!report) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">{t('intelligence.noAnalysisAvailable')}</p>
      </Card>
    );
  }

  const topRootCause = report.rootCauseCandidates?.[0];
  const topResolution = report.resolutionSuggestions?.[0];

  return (
    <div className="space-y-6">
      {/* Root Cause Analysis */}
      {topRootCause && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground">
                {t('intelligence.probableCause')}
              </h3>
              <p className="mt-2 text-lg font-medium">{topRootCause.title}</p>
              <div className="mt-2 flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('intelligence.confidence')}: </span>
                  <span className="font-semibold text-green-600">
                    {Math.round(topRootCause.confidence)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('intelligence.frequency')}: </span>
                  <span className="font-semibold">{topRootCause.frequency} {t('intelligence.occurrences')}</span>
                </div>
              </div>
            </div>

            {!isResolved && (
              <Button
                onClick={() => setSelectedRootCause(topRootCause)}
                variant="outline"
                size="sm"
              >
                {t('intelligence.selectAsCause')}
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Resolution Suggestion */}
      {topResolution && (
        <Card className="p-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground">
                {t('intelligence.suggestedSolution')}
              </h3>
              <p className="mt-2 text-lg font-medium">{topResolution.summary}</p>

              <div className="mt-4 bg-muted/50 rounded p-3">
                <p className="text-sm whitespace-pre-wrap">{topResolution.resolutionSteps}</p>
              </div>

              <div className="mt-4 flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">{t('intelligence.successRate')}: </span>
                  <span className="font-semibold text-green-600">
                    {Math.round(topResolution.successRate)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">{t('intelligence.appliedCount')}: </span>
                  <span className="font-semibold">{topResolution.appliedCount}x</span>
                </div>
              </div>
            </div>

            {!isResolved && (
              <>
                <Button
                  onClick={() => {
                    setSelectedResolution(topResolution);
                    setShowConfirmation(true);
                  }}
                  disabled={!selectedRootCause}
                  className="w-full"
                >
                  {resolveWithAiMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('intelligence.resolving')}
                    </>
                  ) : (
                    t('intelligence.resolveWithAi')
                  )}
                </Button>

                {showConfirmation && selectedResolution && (
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 space-y-3">
                    <p className="text-sm font-medium">
                      {t('intelligence.confirmResolution')}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => resolveWithAiMutation.mutate()}
                        size="sm"
                        variant="default"
                      >
                        {t('common.confirm')}
                      </Button>
                      <Button
                        onClick={() => setShowConfirmation(false)}
                        size="sm"
                        variant="outline"
                      >
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      )}

      {/* Already Resolved */}
      {isResolved && (
        <Card className="p-6 bg-green-50 border-green-200">
          <p className="text-green-800 font-medium">
            {t('intelligence.ticketAlreadyResolved')}
          </p>
        </Card>
      )}

      {/* All candidates */}
      {report.rootCauseCandidates && report.rootCauseCandidates.length > 1 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">{t('intelligence.otherPossibleCauses')}</h3>
          <div className="space-y-3">
            {report.rootCauseCandidates.slice(1).map((cause) => (
              <div key={cause.rootCauseId} className="p-3 bg-muted/50 rounded">
                <p className="font-medium text-sm">{cause.title}</p>
                <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                  <span>{t('intelligence.confidence')}: {Math.round(cause.confidence)}%</span>
                  <span>{t('intelligence.frequency')}: {cause.frequency}x</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
