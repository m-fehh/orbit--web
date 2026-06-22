'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, FlaskConical, GitBranch, CheckCircle2, Lightbulb, FileText, Link2, Upload, Loader } from 'lucide-react';
import { investigationsApi, rootCausesApi } from '@/shared/api/endpoints';
import {
  apiErrorMessage, EvidenceType, HypothesisStatus, RootCauseCategory,
  type InvestigationResponse, type HypothesisStatusValue, type EvidenceTypeValue, type RootCauseCategoryValue,
} from '@/shared/api/types';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Select } from '@/shared/ui/select';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { LoadingState, EmptyState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

/* ---- Input nativo, padronizado e compacto. Evita o componente <Input>
       global (floating label / glow / partículas) que estava deixando o
       layout torto e com um "_" embaixo das labels. ---- */
const FIELD_BASE =
  'w-full rounded-md border border-border bg-bg-subtle px-2.5 text-sm text-text outline-none ' +
  'placeholder:text-dim transition-colors hover:border-border-strong focus:border-primary ' +
  'focus:ring-2 focus:ring-primary/20';
const FIELD_MD = `${FIELD_BASE} h-9`;
const FIELD_SM = `${FIELD_BASE} h-8 text-xs`;

/** F5.7 + F5.8 — Investigações e Causas Raiz do ticket. */
export function InvestigationTab({ ticketId, investigations }: { ticketId: number; investigations: InvestigationResponse[] }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const [summary, setSummary] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });

  const create = useMutation({
    mutationFn: () => investigationsApi.create(ticketId, { summary: summary.trim() }),
    onSuccess: () => { setSummary(''); invalidate(); toast.success(t('create')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  return (
    <div className="flex flex-col gap-lg">
      <section>
        <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
          <FlaskConical className="h-4 w-4 text-primary" /> {t('title')}
        </p>

        <Can permission="investigation.create">
          <form
            onSubmit={(e) => { e.preventDefault(); if (summary.trim()) create.mutate(); }}
            className="mb-sm flex items-center gap-sm"
          >
            <input
              className={FIELD_MD}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t('newPh')}
            />
            <Button type="submit" disabled={!summary.trim()} loading={create.isPending}>
              <Plus className="h-4 w-4" /> {t('create')}
            </Button>
          </form>
        </Can>

        {investigations.length === 0 ? (
          <p className="text-sm text-dim">{t('empty')}</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {investigations.map((inv) => (
              <InvestigationCard key={inv.id} inv={inv} onChanged={invalidate} />
            ))}
          </div>
        )}
      </section>

      <RootCausesSection ticketId={ticketId} />
    </div>
  );
}

const HYP_STYLE: Record<string, string> = {
  Open: 'bg-info/15 text-info',
  Confirmed: 'bg-success/15 text-success',
  Discarded: 'bg-panel-2 text-dim',
};

/** Placeholders por tipo de evidência (sugestão de conteúdo / autocomplete). */
function getEvidenceHints(t: (key: string) => string): Record<EvidenceTypeValue, { ph: string; suggestions: string[]; needsUrl: boolean }> {
  return {
    [EvidenceType.Screenshot]: { ph: t('evidenceHints.screenshotPlaceholder'), suggestions: t('evidenceHints.screenshotSuggestions').split(', '), needsUrl: false },
    [EvidenceType.Log]: { ph: t('evidenceHints.logPlaceholder'), suggestions: t('evidenceHints.logSuggestions').split(', '), needsUrl: false },
    [EvidenceType.Video]: { ph: t('evidenceHints.videoPlaceholder'), suggestions: t('evidenceHints.videoSuggestions').split(', '), needsUrl: true },
    [EvidenceType.File]: { ph: t('evidenceHints.filePlaceholder'), suggestions: t('evidenceHints.fileSuggestions').split(', '), needsUrl: false },
    [EvidenceType.Observation]: { ph: t('evidenceHints.observationPlaceholder'), suggestions: t('evidenceHints.observationSuggestions').split(', '), needsUrl: false },
    [EvidenceType.Url]: { ph: t('evidenceHints.urlPlaceholder'), suggestions: t('evidenceHints.urlSuggestions').split(', '), needsUrl: true },
  };
}

function InvestigationCard({ inv, onChanged }: { inv: InvestigationResponse; onChanged: () => void }) {
  const t = useTranslations('investigation');
  const finished = !!inv.finishedAt;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hyp, setHyp] = useState('');
  const [finding, setFinding] = useState('');
  const [evType, setEvType] = useState<EvidenceTypeValue>(EvidenceType.Observation);
  const [evNotes, setEvNotes] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');

  const run = (p: Promise<unknown>, ok?: () => void) =>
    p.then(() => { toast.success(t('saved')); onChanged(); ok?.(); }).catch((e) => toast.error(apiErrorMessage(e, t('saveError'))));

  const addHypoMutation = useMutation({
    mutationFn: (desc: string) => investigationsApi.addHypothesis(inv.id, { description: desc }),
    onSuccess: () => { setHyp(''); onChanged(); toast.success(t('hypothesisAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const addFindingMutation = useMutation({
    mutationFn: (desc: string) => investigationsApi.addFinding(inv.id, { description: desc }),
    onSuccess: () => { setFinding(''); onChanged(); toast.success(t('findingAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const addEvidenceMutation = useMutation({
    mutationFn: (data: any) => investigationsApi.addEvidence(inv.id, data),
    onSuccess: () => { setEvNotes(''); setEvUrl(''); onChanged(); toast.success(t('evidenceAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const setRootCauseMutation = useMutation({
    mutationFn: (rcId: number) => investigationsApi.setRootCause(inv.id, rcId),
    onSuccess: () => { onChanged(); toast.success(t('rootCauseLinked')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const uploadEvidenceMutation = useMutation({
    mutationFn: (file: File) => investigationsApi.uploadEvidence(inv.id, file, evType.toString(), uploadNotes.trim() || undefined),
    onSuccess: () => { setUploadFile(null); setUploadNotes(''); onChanged(); toast.success(t('evidenceAdded')); if (fileInputRef.current) fileInputRef.current.value = ''; },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const rootCauses = useQuery({
    queryKey: ['rootcauses', inv.ticketId],
    queryFn: () => rootCausesApi.byTicket(inv.ticketId),
  });

  const rcOptions: ComboOption[] = (rootCauses.data ?? []).map(rc => ({
    id: rc.id,
    label: rc.title,
    hint: `${Math.round(rc.confidenceScore * 100)}%`,
  }));

  const evidenceHints = getEvidenceHints(t as any);
  const evHint = evidenceHints[evType];
  const datalistId = `inv-${inv.id}-ev-suggestions`;

  return (
    <div className="card-surface p-md">
      {/* Cabeçalho da investigação */}
      <div className="flex items-center gap-sm">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <FlaskConical className="h-4 w-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{inv.summary}</p>
        <span className={cn(
          'shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold uppercase',
          finished ? 'bg-success/15 text-success' : 'bg-info/15 text-info',
        )}>
          {finished ? t('finished') : t('inProgress')}
        </span>
        {!finished && (
          <Can permission="investigation.finish">
            <Button size="sm" variant="secondary" onClick={() => run(investigationsApi.finish(inv.id))}>
              <CheckCircle2 className="h-3.5 w-3.5" /> {t('finish')}
            </Button>
          </Can>
        )}
      </div>

      {/* 3 colunas alinhadas */}
      <div className="mt-md grid gap-md md:grid-cols-3">
        {/* ── Hipóteses ── */}
        <div className="flex flex-col">
          <p className="mb-2 flex h-5 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-dim">
            <GitBranch className="h-3.5 w-3.5" /> {t('hypotheses')}
          </p>
          <ul className="flex flex-col gap-1">
            {inv.hypotheses.length === 0 && <li className="text-xs text-dim">—</li>}
            {inv.hypotheses.map((h) => (
              <li key={h.id} className="flex items-center gap-1 text-xs">
                <span className="flex-1 truncate">{h.description}</span>
                <Can
                  permission="investigation.hypothesis.update"
                  fallback={
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', HYP_STYLE[h.status])}>
                      {t(`hStatus.${h.status}` as 'hStatus.Open')}
                    </span>
                  }
                >
                  <select
                    value={HypothesisStatus[h.status as keyof typeof HypothesisStatus] ?? HypothesisStatus.Open}
                    onChange={(e) =>
                      run(investigationsApi.updateHypothesisStatus(h.id, Number(e.target.value) as HypothesisStatusValue))
                    }
                    className="rounded border border-border bg-bg-subtle px-1.5 py-0.5 text-[11px] outline-none"
                  >
                    {Object.entries(HypothesisStatus).map(([k, v]) => (
                      <option key={k} value={v}>{t(`hStatus.${k}` as 'hStatus.Open')}</option>
                    ))}
                  </select>
                </Can>
              </li>
            ))}
          </ul>
          {!finished && (
            <Can permission="investigation.hypothesis.add">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (hyp.trim()) addHypoMutation.mutate(hyp.trim());
                }}
                className="mt-2"
              >
                <input
                  className={FIELD_SM}
                  value={hyp}
                  onChange={(e) => setHyp(e.target.value)}
                  placeholder={t('addHypothesis')}
                  disabled={addHypoMutation.isPending}
                />
              </form>
            </Can>
          )}
        </div>

        {/* ── Achados ── */}
        <div className="flex flex-col">
          <p className="mb-2 flex h-5 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-dim">
            <Lightbulb className="h-3.5 w-3.5" /> {t('findings')}
          </p>
          <ul className="flex flex-col gap-1">
            {inv.findingItems.length === 0 && <li className="text-xs text-dim">—</li>}
            {inv.findingItems.map((f) => (
              <li key={f.id} className="truncate text-xs">• {f.description}</li>
            ))}
          </ul>
          {!finished && (
            <Can permission="investigation.finding.add">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (finding.trim()) addFindingMutation.mutate(finding.trim());
                }}
                className="mt-2"
              >
                <input
                  className={FIELD_SM}
                  value={finding}
                  onChange={(e) => setFinding(e.target.value)}
                  placeholder={t('addFinding')}
                  disabled={addFindingMutation.isPending}
                />
              </form>
            </Can>
          )}
        </div>

        {/* ── Evidências ── */}
        <div className="flex flex-col">
          <p className="mb-2 flex h-5 items-center gap-1 text-xs font-semibold uppercase tracking-wide text-dim">
            <FileText className="h-3.5 w-3.5" /> {t('evidences')}
          </p>
          <ul className="flex flex-col gap-1">
            {inv.evidences.length === 0 && <li className="text-xs text-dim">—</li>}
            {inv.evidences.map((ev) => (
              <li key={ev.id} className="flex items-center gap-1 text-xs">
                {ev.url ? (
                  <Link2 className="h-3 w-3 shrink-0 text-primary" />
                ) : (
                  <FileText className="h-3 w-3 shrink-0 text-dim" />
                )}
                <span className="truncate">
                  <span className="font-medium text-text">{t(`eType.${ev.type}` as 'eType.Log')}</span>
                  {ev.notes ? ` · ${ev.notes}` : ''}
                </span>
              </li>
            ))}
          </ul>

          {!finished && (
            <Can permission="investigation.evidence.add">
              <div className="mt-2 flex flex-col gap-2 border-t border-border/50 pt-2">
                {/* URL-based evidence */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    addEvidenceMutation.mutate({
                      type: evType,
                      notes: evNotes.trim() || null,
                      url: evHint.needsUrl ? (evUrl.trim() || null) : null,
                    });
                  }}
                  className="flex flex-col gap-1.5"
                >
                  <Select<EvidenceTypeValue>
                    value={evType}
                    onChange={(v) => { setEvType(v); setEvNotes(''); setEvUrl(''); }}
                    options={Object.entries(EvidenceType).map(([k, v]) => ({
                      value: v as EvidenceTypeValue,
                      label: t(`eType.${k}` as 'eType.Log'),
                    }))}
                  />
                  <input
                    list={datalistId}
                    className={FIELD_SM}
                    value={evNotes}
                    onChange={(e) => setEvNotes(e.target.value)}
                    placeholder={evHint.ph}
                    disabled={addEvidenceMutation.isPending}
                  />
                  <datalist id={datalistId}>
                    {evHint.suggestions.map((s) => <option key={s} value={s} />)}
                  </datalist>
                  {evHint.needsUrl && (
                    <input
                      type="url"
                      className={FIELD_SM}
                      value={evUrl}
                      onChange={(e) => setEvUrl(e.target.value)}
                      placeholder={t('url')}
                      disabled={addEvidenceMutation.isPending}
                    />
                  )}
                  <Button type="submit" size="sm" variant="secondary" loading={addEvidenceMutation.isPending}>
                    <Link2 className="h-3.5 w-3.5" /> {t('addUrl')}
                  </Button>
                </form>

                {/* File upload */}
                <div className="flex flex-col gap-1.5 border-t border-border/50 pt-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-dim">
                    <Upload className="h-3 w-3" /> {t('upload')}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className={FIELD_SM}
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    disabled={uploadEvidenceMutation.isPending}
                  />
                  {uploadFile && (
                    <input
                      className={FIELD_SM}
                      value={uploadNotes}
                      onChange={(e) => setUploadNotes(e.target.value)}
                      placeholder={t('notes')}
                      disabled={uploadEvidenceMutation.isPending}
                    />
                  )}
                  {uploadFile && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      loading={uploadEvidenceMutation.isPending}
                      onClick={() => uploadEvidenceMutation.mutate(uploadFile)}
                    >
                      {uploadEvidenceMutation.isPending ? (
                        <><Loader className="h-3.5 w-3.5 animate-spin" /> {t('uploading')}</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5" /> {t('upload')}</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </Can>
          )}
        </div>
      </div>

      {/* Root Cause selection */}
      {finished && (
        <div className="mt-md border-t border-border pt-md">
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-dim">
            <GitBranch className="h-3.5 w-3.5" /> {t('selectRootCause')}
          </p>
          <div className="max-w-xs">
            <AsyncCombobox
              options={rcOptions}
              value={inv.rootCauseId ?? null}
              onChange={(id) => { if (id) setRootCauseMutation.mutate(id); }}
              loading={rootCauses.isLoading || setRootCauseMutation.isPending}
              placeholder={t('selectRootCause')}
              emptyText={t('rootCauseNotFound')}
              allowClear={false}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/** EPIC Root Cause UI - Wizard + Kendo-like Grid */
function RootCausesSection({ ticketId }: { ticketId: number }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1); // 1: info, 2: category, 3: confirm
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RootCauseCategoryValue>(RootCauseCategory.Bug);
  const [confidence, setConfidence] = useState(70);
  const [sortBy, setSortBy] = useState<'confidence' | 'title'>('confidence');
  const [filterCategory, setFilterCategory] = useState<RootCauseCategoryValue | null>(null);

  const list = useQuery({ queryKey: ['rootcauses', ticketId], queryFn: () => rootCausesApi.byTicket(ticketId) });

  const create = useMutation({
    mutationFn: () => rootCausesApi.create(ticketId, {
      title: title.trim(),
      description: description.trim(),
      category,
      confidenceScore: confidence / 100,
    }),
    onSuccess: () => {
      setTitle(''); setDescription(''); setOpen(false); setStep(1); setConfidence(70);
      qc.invalidateQueries({ queryKey: ['rootcauses', ticketId] });
      toast.success(t('rcCreated'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('rcError'))),
  });

  const filteredList = (list.data ?? [])
    .filter(rc => !filterCategory || rc.category === String(filterCategory))
    .sort((a, b) => sortBy === 'confidence' ? (b.confidenceScore - a.confidenceScore) : a.title.localeCompare(b.title));

  const CAT_ICONS: Record<RootCauseCategoryValue, string> = {
    [RootCauseCategory.Bug]: '🐛',
    [RootCauseCategory.Configuration]: '⚙️',
    [RootCauseCategory.Infrastructure]: '🏗️',
    [RootCauseCategory.Process]: '📋',
    [RootCauseCategory.UserError]: '👤',
    [RootCauseCategory.ThirdParty]: '🔗',
    [RootCauseCategory.Documentation]: '📝',
    [RootCauseCategory.Security]: '🔒',
    [RootCauseCategory.Performance]: '⚡',
  };

  // Reset form
  const resetForm = () => {
    setTitle(''); setDescription(''); setCategory(RootCauseCategory.Bug); setConfidence(70);
    setStep(1); setOpen(false);
  };

  return (
    <section>
      <div className="mb-md flex items-center justify-between">
        <p className="flex items-center gap-2 text-base font-bold">
          <GitBranch className="h-5 w-5 text-primary" /> {t('rcSectionTitle')}
        </p>
        <Can permission="rootcause.create">
          <Button onClick={() => { resetForm(); setOpen(true); }} className="bg-primary">
            <Plus className="h-4 w-4 mr-2" /> {t('rcNewCause')}
          </Button>
        </Can>
      </div>

      {/* === WIZARD MODAL === */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-bg rounded-lg shadow-2xl w-full max-w-xl">
            {/* Header */}
            <div className="border-b border-border px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{t('rcModalTitle')}</h2>
                <button onClick={resetForm} className="text-muted hover:text-text">✕</button>
              </div>
              <div className="mt-3 flex gap-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? 'bg-primary' : 'bg-border'}`} />
                ))}
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-6 min-h-64">
              {step === 1 && (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('rcWhatIsCause')}</label>
                    <input
                      className="w-full p-3 rounded border border-border bg-bg-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={t('rcCausePlaceholder')}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('rcDescriptionContext')}</label>
                    <textarea
                      className="w-full p-3 rounded border border-border bg-bg-subtle focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none h-28 resize-none"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t('rcDescriptionPlaceholder')}
                    />
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-4">
                  <label className="block text-sm font-medium">{t('category')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(RootCauseCategory).map(([k, v]) => (
                      <button
                        key={v}
                        onClick={() => setCategory(v as RootCauseCategoryValue)}
                        className={`p-4 rounded-lg border-2 transition-colors ${
                          category === v
                            ? 'border-primary bg-primary/10'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="text-2xl mb-1">{CAT_ICONS[v as RootCauseCategoryValue]}</div>
                        <div className="text-xs font-medium">{k}</div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-6">
                    <label className="block text-sm font-medium mb-3">{t('rcConfidencePct', { value: confidence })}</label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={confidence}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                      className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, var(--color-primary) 0%, var(--color-primary) ${confidence}%, var(--color-border) ${confidence}%, var(--color-border) 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-muted mt-2">
                      <span>{t('rcLow')}</span>
                      <span>{t('rcHigh')}</span>
                    </div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="flex flex-col gap-4">
                  <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                    <p className="text-sm mb-3"><strong>{t('rcSummaryTitle')}</strong></p>
                    <div className="space-y-2 text-sm">
                      <div><span className="text-muted">{t('rcTitleLabel')}</span> <strong>{title}</strong></div>
                      <div><span className="text-muted">{t('rcCategoryLabel')}</span> <strong>{CAT_ICONS[category]} {category}</strong></div>
                      <div><span className="text-muted">{t('rcConfidenceLabel')}</span> <strong className="text-primary">{confidence}%</strong></div>
                      {description && <div className="pt-2 border-t border-primary/20"><span className="text-muted">{t('rcDetailsLabel')}</span><p className="mt-1 text-text">{description}</p></div>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-border px-6 py-4 flex gap-2 justify-end">
              <Button variant="secondary" onClick={resetForm}>{t('cancel')}</Button>
              {step < 3 && <Button onClick={() => setStep(s => s + 1)} disabled={step === 1 && !title.trim()}>{t('rcNext')}</Button>}
              {step === 3 && <Button onClick={() => create.mutate()} loading={create.isPending} className="bg-success hover:bg-success/90">{t('rcCreateCause')}</Button>}
            </div>
          </div>
        </div>
      )}

      {/* === KENDO-LIKE GRID === */}
      {list.isLoading ? (
        <LoadingState />
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState icon={GitBranch} message={t('rcEmptyCauses')} />
      ) : (
        <div className="card-surface overflow-hidden">
          {/* Toolbar */}
          <div className="border-b border-border px-4 py-3 flex gap-3 items-center flex-wrap bg-panel/50">
            <div>
              <select
                value={filterCategory ?? ''}
                onChange={(e) => setFilterCategory((e.target.value || null) as RootCauseCategoryValue | null)}
                className="text-xs px-2 py-1 rounded border border-border bg-bg-subtle focus:border-primary"
              >
                <option value="">{t('rcAllCategories')}</option>
                {Object.entries(RootCauseCategory).map(([k, v]) => (
                  <option key={v} value={v}>{k}</option>
                ))}
              </select>
            </div>
            <div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'confidence' | 'title')}
                className="text-xs px-2 py-1 rounded border border-border bg-bg-subtle focus:border-primary"
              >
                <option value="confidence">{t('rcSortConfidence')}</option>
                <option value="title">{t('rcSortTitle')}</option>
              </select>
            </div>
            <div className="ml-auto text-xs text-muted">{t('rcCausesCount', { count: filteredList.length })}</div>
          </div>

          {/* List */}
          {filteredList.length === 0 ? (
            <div className="p-8 text-center text-muted">
              <p className="text-sm">{t('rcNoCausesFound')}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredList.map((rc) => (
                <div key={rc.id} className="px-4 py-3 hover:bg-panel/50 transition-colors group">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{CAT_ICONS[RootCauseCategory[rc.category as keyof typeof RootCauseCategory] as RootCauseCategoryValue] ?? '❓'}</span>
                        <span className="text-sm font-medium truncate">{rc.title}</span>
                      </div>
                      {rc.description && <p className="text-xs text-muted line-clamp-2">{rc.description}</p>}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-lg font-bold text-primary">{Math.round(rc.confidenceScore * 100)}%</div>
                        <div className="text-[10px] text-muted">{t('rcConfidenceSmall')}</div>
                      </div>
                      {rc.resolutionsCount > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-semibold text-success">{rc.resolutionsCount}</div>
                          <div className="text-[10px] text-muted">{t('rcSolutions')}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
