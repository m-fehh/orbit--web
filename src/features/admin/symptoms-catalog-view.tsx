'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Stethoscope, Plus, Search, Pencil, Check, X, PowerOff, Sparkles, Layers } from 'lucide-react';
import { symptomsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type SymptomTagResponse } from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PageTransition, LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

/** Sugere um código estável e independente de idioma a partir do nome. */
const slugifyCode = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');

export function SymptomsCatalogView() {
  const t = useTranslations('symptomsCatalog');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['symptoms'],
    queryFn: () => symptomsApi.list(),
  });

  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', group: '' });
  const [codeTouched, setCodeTouched] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: '', group: '' });
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const symptoms = data ?? [];
  const groups = useMemo(
    () => [...new Set(symptoms.map((s) => s.group).filter(Boolean))].sort(),
    [symptoms],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return symptoms;
    return symptoms.filter((s) =>
      s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q) || s.group.toLowerCase().includes(q));
  }, [symptoms, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, SymptomTagResponse[]>();
    for (const s of filtered) {
      const g = s.group || t('ungrouped');
      (map.get(g) ?? map.set(g, []).get(g)!).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered, t]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['symptoms'] });

  const create = useMutation({
    mutationFn: () => symptomsApi.create({ code: form.code.trim(), name: form.name.trim(), group: form.group.trim() }),
    onSuccess: () => {
      toast.success(t('created'));
      setForm({ code: '', name: '', group: '' });
      setCodeTouched(false);
      setShowCreate(false);
      invalidate();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('createError'))),
  });

  const update = useMutation({
    mutationFn: (id: number) => symptomsApi.update(id, { name: editForm.name.trim(), group: editForm.group.trim() }),
    onSuccess: () => { toast.success(t('updated')); setEditingId(null); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, t('updateError'))),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => symptomsApi.deactivate(id),
    onSuccess: () => { toast.success(t('deactivated')); setConfirmId(null); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, t('deactivateError'))),
  });

  const startEdit = (s: SymptomTagResponse) => {
    setEditingId(s.id);
    setEditForm({ name: s.name, group: s.group });
  };

  if (isLoading) return <LoadingState label={t('loading')} />;
  if (isError) return <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  return (
    <PageTransition className="flex h-full flex-col gap-lg overflow-auto p-lg">
      <header className="flex flex-wrap items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Stethoscope className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-text">{t('title')}</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('subtitle')}
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="h-4 w-4" /> {t('new')}
        </Button>
      </header>

      {/* Criação */}
      {showCreate && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-md">
          <div className="grid gap-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1 text-xs font-medium text-dim">
              {t('name')}
              <Input
                autoFocus
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, code: codeTouched ? f.code : slugifyCode(name) }));
                }}
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-dim">
              {t('code')}
              <Input
                value={form.code}
                onChange={(e) => { setCodeTouched(true); setForm((f) => ({ ...f, code: e.target.value })); }}
                placeholder="system.unavailable"
                className="font-mono"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-dim">
              {t('group')}
              <Input
                list="symptom-groups"
                value={form.group}
                onChange={(e) => setForm((f) => ({ ...f, group: e.target.value }))}
                placeholder={t('groupPlaceholder')}
              />
            </label>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setShowCreate(false); setForm({ code: '', name: '', group: '' }); setCodeTouched(false); }}>
                {t('cancel')}
              </Button>
              <Button
                loading={create.isPending}
                disabled={!form.name.trim() || !form.code.trim() || !form.group.trim()}
                onClick={() => create.mutate()}
              >
                {t('save')}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-dim">{t('codeHint')}</p>
        </div>
      )}

      <datalist id="symptom-groups">
        {groups.map((g) => <option key={g} value={g} />)}
      </datalist>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('searchPlaceholder')} className="pl-9" />
      </div>

      {/* Catálogo agrupado */}
      {grouped.length === 0 ? (
        <EmptyState icon={Stethoscope} message={t('empty')} />
      ) : (
        <div className="flex flex-col gap-lg">
          {grouped.map(([group, list]) => (
            <section key={group}>
              <div className="mb-2 flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-dim" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-dim">{group}</h2>
                <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-semibold text-dim tabular-nums">{list.length}</span>
              </div>
              <div className="grid gap-1.5">
                {list.map((s) => (
                  <div key={s.id} className="group flex flex-wrap items-center gap-3 rounded-lg border border-border bg-panel px-md py-2.5">
                    {editingId === s.id ? (
                      <>
                        <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} className="h-8 max-w-xs" />
                        <Input list="symptom-groups" value={editForm.group} onChange={(e) => setEditForm((f) => ({ ...f, group: e.target.value }))} className="h-8 max-w-[180px]" />
                        <span className="font-mono text-[11px] text-dim">{s.code}</span>
                        <div className="ml-auto flex gap-1.5">
                          <Button size="sm" loading={update.isPending} disabled={!editForm.name.trim() || !editForm.group.trim()} onClick={() => update.mutate(s.id)}>
                            <Check className="h-3.5 w-3.5" /> {t('save')}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-text">{s.name}</span>
                        <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-[11px] text-dim">{s.code}</span>
                        <div className="ml-auto flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {confirmId === s.id ? (
                            <>
                              <span className="text-xs text-danger">{t('confirmDeactivate')}</span>
                              <Button size="sm" variant="danger" loading={deactivate.isPending} onClick={() => deactivate.mutate(s.id)}>
                                {t('confirm')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmId(null)}>{t('cancel')}</Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => startEdit(s)} aria-label={t('edit')} title={t('edit')}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmId(s.id)} aria-label={t('deactivate')} title={t('deactivate')}>
                                <PowerOff className="h-3.5 w-3.5 text-danger" />
                              </Button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </PageTransition>
  );
}
