'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Library, Search, X, GitBranch, CheckCircle2, Zap, Sparkles, Check, Trash2, Pickaxe, ChevronRight,
} from 'lucide-react';
import { playbooksApi, symptomsApi } from '@/shared/api/endpoints';
import {
  apiErrorMessage,
  type PlaybookResponse, type PlaybookStepKind, type PlaybookStepResponse,
  type SymptomTagResponse,
} from '@/shared/api/types';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/button';
import { ProgressBar, healthColor, healthTextClass, formatPct } from '@/shared/ui/charts';
import { cn } from '@/shared/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-panel-2 text-dim',
  Published: 'bg-success/15 text-success',
  Archived: 'bg-warning/15 text-warning',
};

type Tab = 'library' | 'review';

function StepKindIcon({ kind, className }: { kind: PlaybookStepKind; className?: string }) {
  if (kind === 'Check') return <CheckCircle2 className={className} />;
  if (kind === 'Decision') return <GitBranch className={className} />;
  return <Zap className={className} />;
}

/* ---- Detalhe (passos completos) ---- */

function SolutionDetail({
  solution,
  symptomName,
  onClose,
}: {
  solution: PlaybookResponse;
  symptomName: (id: number) => string;
  onClose: () => void;
}) {
  const t = useTranslations('playbooks');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Library className="h-4 w-4 text-primary" />
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-text">{solution.title}</h2>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {solution.summary && <p className="mb-4 text-sm text-muted">{solution.summary}</p>}

          <ProvenanceStrip solution={solution} />

          {solution.symptomTagIds.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {solution.symptomTagIds.map((id) => (
                <span key={id} className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">{symptomName(id)}</span>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2">
            <span className="text-sm font-semibold text-text">{t('steps')}</span>
            {solution.steps.length === 0 ? (
              <p className="text-xs text-dim">{t('noSteps')}</p>
            ) : (
              solution.steps
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((s) => <StepRow key={s.order} step={s} />)
            )}
          </div>

          {solution.resolutionTemplate && (
            <div className="mt-5 flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-text">{t('draftTitle')}</span>
              <pre className="whitespace-pre-wrap rounded-lg border border-border bg-bg-subtle p-3 text-xs text-muted">{solution.resolutionTemplate}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({ step }: { step: PlaybookStepResponse }) {
  const t = useTranslations('playbooks');
  return (
    <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{step.order}</span>
        <span className="grid h-6 w-6 place-items-center rounded text-dim"><StepKindIcon kind={step.kind} className="h-3.5 w-3.5" /></span>
        <span className="text-xs font-medium text-dim">{t(`kind.${step.kind}` as 'kind.Check')}</span>
      </div>
      <p className="mt-1.5 text-sm text-text">{step.instruction}</p>
      {step.expectedSignal && <p className="mt-1 text-xs text-muted">{t('expectedSignal')}: {step.expectedSignal}</p>}
      {step.kind === 'Decision' && (step.onYesOrder != null || step.onNoOrder != null) && (
        <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-dim">
          {step.onYesOrder != null && <span>{t('onYes', { order: step.onYesOrder })}</span>}
          {step.onNoOrder != null && <span>{t('onNo', { order: step.onNoOrder })}</span>}
        </div>
      )}
    </div>
  );
}

/* ---- Métricas de confiança / proveniência ---- */

function ProvenanceStrip({ solution }: { solution: PlaybookResponse }) {
  const t = useTranslations('playbooks');
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-bg-subtle/40 p-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>{t('derivedFrom', { count: solution.sourceResolutionCount })}</span>
        <span>{t('appliedTimes', { count: solution.applied })}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-dim">{t('successRate')}</span>
        <ProgressBar value={solution.successRate} color={healthColor(solution.successRate)} className="flex-1" />
        <span className={cn('w-10 text-right text-xs font-semibold tabular-nums', healthTextClass(solution.successRate))}>
          {formatPct(solution.successRate)}
        </span>
      </div>
    </div>
  );
}

/* ---- Card ---- */

function SolutionCard({
  solution,
  symptomName,
  onOpen,
  actions,
}: {
  solution: PlaybookResponse;
  symptomName: (id: number) => string;
  onOpen: () => void;
  actions?: React.ReactNode;
}) {
  const t = useTranslations('playbooks');
  const previewSteps = solution.steps.slice().sort((a, b) => a.order - b.order).slice(0, 4);

  return (
    <div className="card-surface flex flex-col gap-3 p-4 transition-colors hover:border-primary/30">
      <div className="flex items-start gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-text">{solution.title}</p>
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLE[solution.status] ?? 'bg-panel-2 text-dim')}>
              {t(`status.${solution.status}` as 'status.Draft')}
            </span>
            {solution.category && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{solution.category}</span>
            )}
            {solution.isAutoGenerated && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                <Sparkles className="h-2.5 w-2.5" /> {t('autoGeneratedBadge')}
              </span>
            )}
          </div>
          {solution.summary && <p className="mt-1 text-xs text-muted line-clamp-2">{solution.summary}</p>}
        </button>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </div>

      {solution.symptomTagIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {solution.symptomTagIds.slice(0, 5).map((id) => (
            <span key={id} className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{symptomName(id)}</span>
          ))}
          {solution.symptomTagIds.length > 5 && <span className="text-[10px] text-dim">+{solution.symptomTagIds.length - 5}</span>}
        </div>
      )}

      {previewSteps.length > 0 && (
        <ul className="flex flex-col gap-1">
          {previewSteps.map((s) => (
            <li key={s.order} className="flex items-center gap-2 text-xs text-muted">
              <StepKindIcon kind={s.kind} className="h-3.5 w-3.5 shrink-0 text-dim" />
              <span className="min-w-0 flex-1 truncate">{s.instruction}</span>
            </li>
          ))}
          {solution.steps.length > previewSteps.length && (
            <li className="text-[10px] text-dim">+{solution.steps.length - previewSteps.length} {t('steps').toLowerCase()}</li>
          )}
        </ul>
      )}

      <ProvenanceStrip solution={solution} />

      <button type="button" onClick={onOpen} className="inline-flex items-center gap-1 self-start text-xs font-medium text-primary hover:underline">
        {t('viewDetail')} <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ---- View principal ---- */

export function PlaybooksView() {
  const t = useTranslations('playbooks');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>('library');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<PlaybookResponse | null>(null);

  const libraryQ = useQuery({
    queryKey: ['playbooks', 'library', search],
    queryFn: () => playbooksApi.library(search.trim() || undefined),
    enabled: tab === 'library',
  });
  const reviewQ = useQuery({
    queryKey: ['playbooks', 'review'],
    queryFn: () => playbooksApi.review(),
    enabled: tab === 'review',
  });
  const symptomsQ = useQuery({ queryKey: ['symptoms'], queryFn: () => symptomsApi.list() });

  const symptoms = symptomsQ.data ?? [];
  const symptomName = useCallback((id: number) => symptoms.find((s: SymptomTagResponse) => s.id === id)?.name ?? `#${id}`, [symptoms]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['playbooks'] });
  };

  const approve = useMutation({
    mutationFn: (id: number) => playbooksApi.approve(id),
    onSuccess: () => { toast.success(t('approved')); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });
  const discard = useMutation({
    mutationFn: (id: number) => playbooksApi.discard(id),
    onSuccess: () => { toast.success(t('discarded')); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });
  const mine = useMutation({
    mutationFn: () => playbooksApi.mine(),
    onSuccess: () => { toast.success(t('mineStarted')); qc.invalidateQueries({ queryKey: ['playbooks', 'review'] }); setTab('review'); },
    onError: (err) => toast.error(apiErrorMessage(err, t('actionError'))),
  });

  const active = tab === 'library' ? libraryQ : reviewQ;
  const items = useMemo(() => (tab === 'library' ? libraryQ.data : reviewQ.data) ?? [], [tab, libraryQ.data, reviewQ.data]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'library', label: t('tabLibrary') },
    { key: 'review', label: t('tabReview') },
  ];

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
          <Library className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{t('baseTitle')}</h1>
          <p className="text-xs text-muted">{t('baseSubtitle')}</p>
        </div>
        <Button className="gap-1.5" onClick={() => mine.mutate()} loading={mine.isPending}>
          <Pickaxe className="h-4 w-4" /> {t('mineFromHistory')}
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={cn(
              'relative px-3 py-2 text-sm font-medium transition-colors',
              tab === tb.key ? 'text-primary' : 'text-muted hover:text-text',
            )}
          >
            {tb.label}
            {tab === tb.key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        ))}
      </div>

      {/* Busca (só biblioteca) */}
      {tab === 'library' && (
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="w-full rounded-md border border-border bg-bg-subtle py-2 pl-9 pr-3 text-sm text-text outline-none placeholder:text-dim focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}

      {active.isLoading ? (
        <LoadingState />
      ) : active.error ? (
        <ErrorState title={apiErrorMessage(active.error, tc('errorBody'))} onRetry={() => active.refetch()} retryLabel={tc('retry')} />
      ) : items.length === 0 ? (
        <EmptyState icon={Library} message={t('emptyBase')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <SolutionCard
              key={p.id}
              solution={p}
              symptomName={symptomName}
              onOpen={() => setDetail(p)}
              actions={
                tab === 'review' ? (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="gap-1"
                      onClick={() => approve.mutate(p.id)}
                      loading={approve.isPending && approve.variables === p.id}
                    >
                      <Check className="h-3.5 w-3.5" /> {t('approve')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm(t('confirmDiscard', { title: p.title }))) discard.mutate(p.id); }}
                      className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-danger/10 hover:text-danger"
                      aria-label={t('discard')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : undefined
              }
            />
          ))}
        </div>
      )}

      {detail && <SolutionDetail solution={detail} symptomName={symptomName} onClose={() => setDetail(null)} />}
    </div>
  );
}
