'use client';

import { useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Route, Plus, Trash2, ArrowUp, ArrowDown, X, Pencil, GitBranch, CheckCircle2, Zap, Sparkles,
} from 'lucide-react';
import { playbooksApi, symptomsApi, teamsApi } from '@/shared/api/endpoints';
import {
  apiErrorMessage,
  PlaybookStatus, PlaybookStepKindEnum, RootCauseCategory,
  type PlaybookResponse, type SavePlaybookRequest, type PlaybookStepInput,
  type PlaybookStatusValue, type PlaybookStepKindValue, type RootCauseCategoryValue,
  type SymptomTagResponse,
} from '@/shared/api/types';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  Draft: 'bg-panel-2 text-dim',
  Published: 'bg-success/15 text-success',
  Archived: 'bg-warning/15 text-warning',
};

const FIELD =
  'w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-text outline-none placeholder:text-dim transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20';

function StepKindIcon({ kind }: { kind: PlaybookStepKindValue }) {
  if (kind === PlaybookStepKindEnum.Check) return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (kind === PlaybookStepKindEnum.Decision) return <GitBranch className="h-3.5 w-3.5" />;
  return <Zap className="h-3.5 w-3.5" />;
}

/* ---- Editor ---- */

interface EditorStep extends PlaybookStepInput {}

function PlaybookEditor({
  initial,
  symptoms,
  teams,
  onClose,
  onSaved,
}: {
  initial: PlaybookResponse | null;
  symptoms: SymptomTagResponse[];
  teams: { id: number; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations('playbooks');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [status, setStatus] = useState<PlaybookStatusValue>(
    initial ? PlaybookStatus[initial.status] : PlaybookStatus.Draft,
  );
  const [category, setCategory] = useState<RootCauseCategoryValue | ''>(
    initial?.category && initial.category in RootCauseCategory
      ? RootCauseCategory[initial.category as keyof typeof RootCauseCategory]
      : '',
  );
  const [keywords, setKeywords] = useState(initial?.keywords ?? '');
  const [resolutionTemplate, setResolutionTemplate] = useState(initial?.resolutionTemplate ?? '');
  const [escalationTeamId, setEscalationTeamId] = useState<number | ''>(initial?.escalationTeamId ?? '');
  const [symptomTagIds, setSymptomTagIds] = useState<number[]>(initial?.symptomTagIds ?? []);
  const [steps, setSteps] = useState<EditorStep[]>(
    (initial?.steps ?? []).map((s) => ({
      order: s.order,
      kind: PlaybookStepKindEnum[s.kind],
      instruction: s.instruction,
      expectedSignal: s.expectedSignal,
      onYesOrder: s.onYesOrder,
      onNoOrder: s.onNoOrder,
    })),
  );

  const renumber = (arr: EditorStep[]): EditorStep[] => arr.map((s, i) => ({ ...s, order: i + 1 }));

  const addStep = () =>
    setSteps((s) => renumber([...s, { order: s.length + 1, kind: PlaybookStepKindEnum.Check, instruction: '', expectedSignal: null, onYesOrder: null, onNoOrder: null }]));
  const removeStep = (idx: number) => setSteps((s) => renumber(s.filter((_, i) => i !== idx)));
  const moveStep = (idx: number, dir: -1 | 1) =>
    setSteps((s) => {
      const j = idx + dir;
      if (j < 0 || j >= s.length) return s;
      const arr = [...s];
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return renumber(arr);
    });
  const patchStep = (idx: number, patch: Partial<EditorStep>) =>
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, ...patch } : st)));

  const toggleSymptom = (id: number) =>
    setSymptomTagIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const save = useMutation({
    mutationFn: () => {
      const body: SavePlaybookRequest = {
        title: title.trim(),
        summary: summary.trim(),
        status,
        category: category === '' ? null : category,
        keywords: keywords.trim() || null,
        escalationTeamId: escalationTeamId === '' ? null : escalationTeamId,
        resolutionTemplate: resolutionTemplate.trim() || null,
        steps: steps.map((s) => ({
          order: s.order,
          kind: s.kind,
          instruction: s.instruction.trim(),
          expectedSignal: s.expectedSignal?.trim() || null,
          onYesOrder: s.onYesOrder ?? null,
          onNoOrder: s.onNoOrder ?? null,
        })),
        symptomTagIds,
      };
      return initial ? playbooksApi.update(initial.id, body) : playbooksApi.create(body);
    },
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['playbooks'] });
      onSaved();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const canSave = title.trim().length > 0 && !save.isPending;

  const kindOptions: { value: PlaybookStepKindValue; label: string }[] = [
    { value: PlaybookStepKindEnum.Check, label: t('kind.Check') },
    { value: PlaybookStepKindEnum.Action, label: t('kind.Action') },
    { value: PlaybookStepKindEnum.Decision, label: t('kind.Decision') },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-panel shadow-xl">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Route className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold text-text">{initial ? t('editTitle') : t('newPlaybook')}</h2>
          <button type="button" onClick={onClose} className="ml-auto grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-text">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            {/* Base fields */}
            <label className="flex flex-col gap-1 text-sm text-text">
              {t('fieldTitle')}
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={FIELD} placeholder={t('titlePh')} />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('fieldSummary')}
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} className={FIELD} placeholder={t('summaryPh')} />
            </label>

            <div className="grid gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm text-text">
                {t('fieldStatus')}
                <select value={status} onChange={(e) => setStatus(Number(e.target.value) as PlaybookStatusValue)} className={FIELD}>
                  <option value={PlaybookStatus.Draft}>{t('status.Draft')}</option>
                  <option value={PlaybookStatus.Published}>{t('status.Published')}</option>
                  <option value={PlaybookStatus.Archived}>{t('status.Archived')}</option>
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-text">
                {t('fieldCategory')}
                <select value={category} onChange={(e) => setCategory(e.target.value === '' ? '' : Number(e.target.value) as RootCauseCategoryValue)} className={FIELD}>
                  <option value="">{t('noCategory')}</option>
                  {Object.entries(RootCauseCategory).map(([name, val]) => (
                    <option key={val} value={val}>{name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-text">
                {t('fieldEscalationTeam')}
                <select value={escalationTeamId} onChange={(e) => setEscalationTeamId(e.target.value === '' ? '' : Number(e.target.value))} className={FIELD}>
                  <option value="">{t('noTeam')}</option>
                  {teams.map((tm) => (
                    <option key={tm.id} value={tm.id}>{tm.name}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('fieldKeywords')}
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className={FIELD} placeholder={t('keywordsPh')} />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('fieldResolutionTemplate')}
              <textarea value={resolutionTemplate} onChange={(e) => setResolutionTemplate(e.target.value)} rows={3} className={FIELD} placeholder={t('resolutionTemplatePh')} />
            </label>

            {/* Symptom triggers */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-text">{t('fieldSymptoms')}</span>
              {symptoms.length === 0 ? (
                <p className="text-xs text-dim">{t('noSymptomsCatalog')}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-bg-subtle p-2.5">
                  {symptoms.map((s) => {
                    const active = symptomTagIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSymptom(s.id)}
                        className={cn(
                          'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          active ? 'bg-primary text-primary-fg' : 'bg-panel-2 text-muted hover:text-text',
                        )}
                      >
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Steps editor */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-text">{t('fieldSteps')}</span>
                <Button size="sm" variant="secondary" className="gap-1.5" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5" /> {t('addStep')}
                </Button>
              </div>

              {steps.length === 0 && <p className="text-xs text-dim">{t('noSteps')}</p>}

              <div className="flex flex-col gap-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">{step.order}</span>
                      <select
                        value={step.kind}
                        onChange={(e) => patchStep(idx, { kind: Number(e.target.value) as PlaybookStepKindValue })}
                        className="h-8 rounded-md border border-border bg-panel px-2 text-xs text-text outline-none focus:border-primary"
                      >
                        {kindOptions.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <span className="grid h-6 w-6 place-items-center rounded text-dim"><StepKindIcon kind={step.kind} /></span>
                      <div className="ml-auto flex items-center gap-0.5">
                        <button type="button" onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-panel-2 disabled:opacity-30"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-panel-2 disabled:opacity-30"><ArrowDown className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => removeStep(idx)} className="grid h-7 w-7 place-items-center rounded text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>

                    <textarea
                      value={step.instruction}
                      onChange={(e) => patchStep(idx, { instruction: e.target.value })}
                      rows={2}
                      placeholder={t('instructionPh')}
                      className={cn(FIELD, 'mt-2 text-xs')}
                    />
                    <input
                      value={step.expectedSignal ?? ''}
                      onChange={(e) => patchStep(idx, { expectedSignal: e.target.value })}
                      placeholder={t('expectedSignalPh')}
                      className={cn(FIELD, 'mt-2 text-xs')}
                    />

                    {step.kind === PlaybookStepKindEnum.Decision && (
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <label className="flex flex-col gap-1 text-[11px] text-dim">
                          {t('onYesLabel')}
                          <input
                            type="number" min={1}
                            value={step.onYesOrder ?? ''}
                            onChange={(e) => patchStep(idx, { onYesOrder: e.target.value === '' ? null : Number(e.target.value) })}
                            className={cn(FIELD, 'text-xs')}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-dim">
                          {t('onNoLabel')}
                          <input
                            type="number" min={1}
                            value={step.onNoOrder ?? ''}
                            onChange={(e) => patchStep(idx, { onNoOrder: e.target.value === '' ? null : Number(e.target.value) })}
                            className={cn(FIELD, 'text-xs')}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3.5">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-muted hover:bg-bg-subtle">{tc('cancel')}</button>
          <Button onClick={() => save.mutate()} disabled={!canSave} loading={save.isPending}>{tc('save')}</Button>
        </div>
      </div>
    </div>
  );
}

/* ---- List / catalog ---- */

export function PlaybooksView() {
  const t = useTranslations('playbooks');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<PlaybookResponse | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => playbooksApi.list(),
  });
  const symptomsQ = useQuery({ queryKey: ['symptoms'], queryFn: () => symptomsApi.list() });
  const teamsQ = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const items = data ?? [];
  const symptoms = symptomsQ.data ?? [];
  const teams = useMemo(() => (teamsQ.data ?? []).map((t) => ({ id: t.id, name: t.name })), [teamsQ.data]);
  const symptomName = useCallback((id: number) => symptoms.find((s) => s.id === id)?.name ?? `#${id}`, [symptoms]);

  const remove = useMutation({
    mutationFn: (id: number) => playbooksApi.remove(id),
    onSuccess: () => { toast.success(t('deleted')); qc.invalidateQueries({ queryKey: ['playbooks'] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('deleteError'))),
  });

  const openNew = () => { setEditing(null); setEditorOpen(true); };
  const openEdit = (p: PlaybookResponse) => { setEditing(p); setEditorOpen(true); };

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />;

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5">
          <Route className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
        <Button className="gap-1.5" onClick={openNew}>
          <Plus className="h-4 w-4" /> {t('newPlaybook')}
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState icon={Route} message={t('emptyCatalog')} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((p) => (
            <div key={p.id} className="card-surface flex flex-col gap-2 p-4 transition-colors hover:border-primary/30">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-text">{p.title}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', STATUS_STYLE[p.status] ?? 'bg-panel-2 text-dim')}>
                      {t(`status.${p.status}` as 'status.Draft')}
                    </span>
                    {p.isAutoGenerated && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">
                        <Sparkles className="h-2.5 w-2.5" /> {t('autoGenerated')}
                      </span>
                    )}
                  </div>
                  {p.summary && <p className="mt-1 text-xs text-muted line-clamp-2">{p.summary}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => openEdit(p)} className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-primary" aria-label={t('editTitle')}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(t('confirmDelete', { title: p.title }))) remove.mutate(p.id); }}
                    className="grid h-8 w-8 place-items-center rounded-md text-dim hover:bg-danger/10 hover:text-danger"
                    aria-label={t('delete')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="rounded bg-panel-2 px-1.5 py-0.5 font-medium text-dim">{t('stepsCount', { count: p.steps.length })}</span>
                {p.category && <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{p.category}</span>}
                <span className="rounded bg-panel-2 px-1.5 py-0.5 font-medium text-dim">v{p.version}</span>
              </div>

              {p.symptomTagIds.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {p.symptomTagIds.slice(0, 5).map((id) => (
                    <span key={id} className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">{symptomName(id)}</span>
                  ))}
                  {p.symptomTagIds.length > 5 && <span className="text-[10px] text-dim">+{p.symptomTagIds.length - 5}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <PlaybookEditor
          initial={editing}
          symptoms={symptoms}
          teams={teams}
          onClose={() => setEditorOpen(false)}
          onSaved={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}
