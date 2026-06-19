'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Plus, FlaskConical, GitBranch, CheckCircle2, Lightbulb, FileText, Link2 } from 'lucide-react';
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
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro')),
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
const EVIDENCE_HINTS: Record<EvidenceTypeValue, { ph: string; suggestions: string[]; needsUrl: boolean }> = {
  [EvidenceType.Screenshot]: { ph: 'O que aparece na captura?', suggestions: ['Tela de erro 500', 'Modal de pagamento', 'Console do navegador'], needsUrl: false },
  [EvidenceType.Log]: { ph: 'Trecho relevante do log…', suggestions: ['Stack trace', 'Linha de exceção', 'Resposta da API'], needsUrl: false },
  [EvidenceType.Video]: { ph: 'Descreva o que o vídeo demonstra', suggestions: ['Passos para reproduzir', 'Comportamento esperado vs real'], needsUrl: true },
  [EvidenceType.File]: { ph: 'Descrição do arquivo anexo', suggestions: ['Dump de banco', 'Configuração exportada'], needsUrl: false },
  [EvidenceType.Observation]: { ph: 'O que foi observado?', suggestions: ['Reproduz somente em produção', 'Ocorre após login', 'Intermitente'], needsUrl: false },
  [EvidenceType.Url]: { ph: 'Por que esta URL é relevante?', suggestions: ['Issue relacionada', 'Documento de referência', 'Endpoint afetado'], needsUrl: true },
};

function InvestigationCard({ inv, onChanged }: { inv: InvestigationResponse; onChanged: () => void }) {
  const t = useTranslations('investigation');
  const finished = !!inv.finishedAt;
  const [hyp, setHyp] = useState('');
  const [finding, setFinding] = useState('');
  const [evType, setEvType] = useState<EvidenceTypeValue>(EvidenceType.Observation);
  const [evNotes, setEvNotes] = useState('');
  const [evUrl, setEvUrl] = useState('');

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

  const rootCauses = useQuery({
    queryKey: ['rootcauses', inv.ticketId],
    queryFn: () => rootCausesApi.byTicket(inv.ticketId),
  });

  const rcOptions: ComboOption[] = (rootCauses.data ?? []).map(rc => ({
    id: rc.id,
    label: rc.title,
    hint: `${Math.round(rc.confidenceScore * 100)}%`,
  }));

  const evHint = EVIDENCE_HINTS[evType];
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addEvidenceMutation.mutate({
                    type: evType,
                    notes: evNotes.trim() || null,
                    url: evHint.needsUrl ? (evUrl.trim() || null) : null,
                  });
                }}
                className="mt-2 flex flex-col gap-1.5"
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
                  <Plus className="h-3.5 w-3.5" /> {t('add')}
                </Button>
              </form>
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

function RootCausesSection({ ticketId }: { ticketId: number }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RootCauseCategoryValue>(RootCauseCategory.Bug);
  const [confidence, setConfidence] = useState('70');

  const list = useQuery({ queryKey: ['rootcauses', ticketId], queryFn: () => rootCausesApi.byTicket(ticketId) });

  const create = useMutation({
    mutationFn: () => rootCausesApi.create(ticketId, {
      title: title.trim(),
      description: description.trim(),
      category,
      confidenceScore: (Number(confidence) || 0) / 100,
    }),
    onSuccess: () => {
      setTitle(''); setDescription(''); setOpen(false);
      qc.invalidateQueries({ queryKey: ['rootcauses', ticketId] });
      toast.success(t('newRootCause'));
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro')),
  });

  return (
    <section>
      <div className="mb-sm flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <GitBranch className="h-4 w-4 text-primary" /> {t('rootCauses')}
        </p>
        <Can permission="rootcause.create">
          <Button size="sm" variant="secondary" onClick={() => setOpen((v) => !v)}>
            <Plus className="h-4 w-4" /> {t('newRootCause')}
          </Button>
        </Can>
      </div>

      {open && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }}
          className="card-surface mb-sm flex flex-col gap-sm p-md"
        >
          <input className={FIELD_MD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('rcTitle')} />
          <input className={FIELD_MD} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('rcDescription')} />
          <div className="flex flex-wrap items-end gap-sm">
            <div className="w-56">
              <Select<RootCauseCategoryValue>
                value={category}
                onChange={setCategory}
                options={Object.entries(RootCauseCategory).map(([k, v]) => ({
                  value: v as RootCauseCategoryValue,
                  label: t(`cat.${k}` as 'cat.Bug'),
                }))}
              />
            </div>
            <label className="flex w-32 flex-col gap-1 text-xs text-muted">
              {t('confidence')} (%)
              <input type="number" min={0} max={100} className={FIELD_MD} value={confidence} onChange={(e) => setConfidence(e.target.value)} />
            </label>
            <Button type="submit" disabled={!title.trim()} loading={create.isPending}>{t('save')}</Button>
          </div>
        </form>
      )}

      {list.isLoading ? (
        <LoadingState />
      ) : (list.data?.length ?? 0) === 0 ? (
        <EmptyState icon={GitBranch} message={t('emptyRc')} />
      ) : (
        <div className="flex flex-col gap-sm">
          {list.data!.map((rc) => (
            <div key={rc.id} className="card-surface p-md">
              <div className="flex items-center gap-sm">
                <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs font-medium text-muted">{t(`cat.${rc.category}` as 'cat.Bug')}</span>
                <span className="flex-1 truncate text-sm font-medium">{rc.title}</span>
                <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                  {Math.round(rc.confidenceScore * 100)}%
                </span>
              </div>
              {rc.description && <p className="mt-1 text-sm text-muted">{rc.description}</p>}
              {rc.resolutionsCount > 0 && (
                <p className="mt-1 text-xs text-dim">{rc.resolutionsCount} {t('resolutions')}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
