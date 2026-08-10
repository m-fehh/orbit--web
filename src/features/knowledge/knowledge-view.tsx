'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Search, X, History, Pencil, CheckCircle2, Archive, RotateCcw } from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import type { KnowledgeAssetResponse } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { Can } from '@/features/auth/can';
import { cn } from '@/shared/lib/utils';

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function PublishBadge({ published, on, off }: { published: boolean; on: string; off: string }) {
  return (
    <span className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      published ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    )}>
      {published ? on : off}
    </span>
  );
}

export function KnowledgeView() {
  const t = useTranslations('knowledge');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [selected, setSelected] = useState<KnowledgeAssetResponse | null>(null);
  const [editing, setEditing] = useState<KnowledgeAssetResponse | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const listQuery = useQuery({
    queryKey: ['knowledge', debounced],
    queryFn: () => knowledgeApi.list({ pageSize: 200, search: debounced || undefined }),
  });
  const items = listQuery.data?.items ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ['knowledge'] });

  const createMut = useMutation({
    mutationFn: (body: { title: string; summary: string; content: string; category?: string | null; tags?: string | null }) => knowledgeApi.create(body),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { title: string; summary: string; content: string; category?: string | null; tags?: string | null } }) => knowledgeApi.update(id, body),
    onSuccess: (updated) => { invalidate(); setSelected(updated); closeForm(); },
  });
  const publishMut = useMutation({
    mutationFn: (id: number) => knowledgeApi.publish(id),
    onSuccess: () => { invalidate(); if (selected) setSelected({ ...selected, isPublished: true }); },
  });
  const archiveMut = useMutation({
    mutationFn: (id: number) => knowledgeApi.archive(id),
    onSuccess: () => { invalidate(); if (selected) setSelected({ ...selected, isPublished: false }); },
  });

  function closeForm() { setShowForm(false); setEditing(null); }

  const openCreate = useCallback(() => { setEditing(null); setShowForm(true); }, []);
  const openEdit = useCallback((asset: KnowledgeAssetResponse) => { setEditing(asset); setShowForm(true); }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      title: (fd.get('title') as string).trim(),
      summary: (fd.get('summary') as string).trim(),
      content: (fd.get('content') as string) ?? '',
      category: ((fd.get('category') as string) || '').trim() || null,
      tags: ((fd.get('tags') as string) || '').trim() || null,
    };
    if (editing) updateMut.mutate({ id: editing.id, body });
    else createMut.mutate(body);
  }, [editing, createMut, updateMut]);

  const columns = useMemo<ColumnDef<KnowledgeAssetResponse>[]>(() => [
    { field: 'title', header: t('titleCol'), width: 340, sortable: true },
    { field: 'category', header: t('category'), width: 160, render: (v: string | null) => v ? <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs text-muted">{v}</span> : <span className="text-muted">—</span> },
    { field: 'isPublished', header: t('status'), width: 120, align: 'center', render: (v: boolean) => <PublishBadge published={v} on={t('published')} off={t('draft')} /> },
    { field: 'reuseCount', header: t('reuse'), width: 100, align: 'center', sortable: true, render: (v: number) => <span className="tabular-nums">{v}</span> },
    { field: 'updatedAt', header: t('updatedAt'), width: 170, sortable: true, render: (v: string | null) => <span className="text-xs text-muted">{fmtDate(v)}</span> },
  ], [t]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </div>

      <DataGrid<KnowledgeAssetResponse>
        gridId="knowledge"
        columns={columns}
        data={items}
        rowKey="id"
        loading={listQuery.isLoading}
        error={listQuery.error ? apiErrorMessage(listQuery.error, tc('errorBody')) : null}
        onRefresh={() => listQuery.refetch()}
        onRowClick={(row) => setSelected(row)}
        emptyMessage={t('empty')}
        toolbar={
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('searchPlaceholder')}
                className="w-full rounded border border-border bg-bg-subtle py-1.5 pl-8 pr-3 text-xs text-text focus:border-primary outline-none"
              />
            </div>
            <Can permission="knowledge.create">
              <button onClick={openCreate} className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                <Plus className="h-3.5 w-3.5" /> {t('newAsset')}
              </button>
            </Can>
          </div>
        }
      />

      {selected && !showForm && (
        <DetailModal
          asset={selected}
          onClose={() => setSelected(null)}
          onEdit={() => openEdit(selected)}
          onPublish={() => publishMut.mutate(selected.id)}
          onArchive={() => archiveMut.mutate(selected.id)}
          onVersions={() => setShowVersions(true)}
          busy={publishMut.isPending || archiveMut.isPending}
        />
      )}

      {showForm && (
        <FormModal editing={editing} onClose={closeForm} onSubmit={handleSubmit} pending={createMut.isPending || updateMut.isPending} />
      )}

      {showVersions && selected && (
        <VersionsModal
          asset={selected}
          onClose={() => setShowVersions(false)}
          onRolledBack={(updated) => { invalidate(); setSelected(updated); setShowVersions(false); }}
        />
      )}
    </div>
  );
}

function DetailModal({
  asset, onClose, onEdit, onPublish, onArchive, onVersions, busy,
}: {
  asset: KnowledgeAssetResponse;
  onClose: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onVersions: () => void;
  busy: boolean;
}) {
  const t = useTranslations('knowledge');
  const tc = useTranslations('common');
  const tags = (asset.tags ?? '').split(',').map((s) => s.trim()).filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col rounded-xl border border-border bg-panel shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PublishBadge published={asset.isPublished} on={t('published')} off={t('draft')} />
              {asset.category && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-xs text-muted">{asset.category}</span>}
              <span className="text-xs text-muted">{t('reuseN', { count: asset.reuseCount })}</span>
            </div>
            <h2 className="mt-1.5 truncate text-lg font-semibold text-text" title={asset.title}>{asset.title}</h2>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-bg-subtle" aria-label={tc('close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {asset.summary && <p className="mb-4 rounded-lg border border-border bg-bg-subtle/50 p-3 text-sm text-muted">{asset.summary}</p>}
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text">{asset.content}</div>
          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tags.map((tag) => <span key={tag} className="rounded bg-primary/10 px-2 py-0.5 text-[11px] text-primary">#{tag}</span>)}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3">
          <button onClick={onVersions} className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted hover:border-primary hover:text-primary">
            <History className="h-3.5 w-3.5" /> {t('versions')}
          </button>
          <div className="flex-1" />
          {asset.isPublished ? (
            <Can permission="knowledge.archive">
              <button disabled={busy} onClick={onArchive} className="inline-flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-text disabled:opacity-50">
                <Archive className="h-3.5 w-3.5" /> {t('archive')}
              </button>
            </Can>
          ) : (
            <Can permission="knowledge.publish">
              <button disabled={busy} onClick={onPublish} className="inline-flex items-center gap-1.5 rounded bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('publish')}
              </button>
            </Can>
          )}
          <Can permission="knowledge.update">
            <button onClick={onEdit} className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
              <Pencil className="h-3.5 w-3.5" /> {t('edit')}
            </button>
          </Can>
        </div>
      </div>
    </div>
  );
}

function FormModal({
  editing, onClose, onSubmit, pending,
}: {
  editing: KnowledgeAssetResponse | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  pending: boolean;
}) {
  const t = useTranslations('knowledge');
  const tc = useTranslations('common');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={onSubmit} className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-3 overflow-y-auto rounded-xl border border-border bg-panel p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-text">{editing ? t('editAsset') : t('newAsset')}</h2>

        <label className="flex flex-col gap-1 text-sm text-text">
          {t('titleCol')}
          <input name="title" required defaultValue={editing?.title ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
        </label>

        <label className="flex flex-col gap-1 text-sm text-text">
          {t('summary')}
          <input name="summary" required defaultValue={editing?.summary ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm text-text">
            {t('category')}
            <input name="category" defaultValue={editing?.category ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
          </label>
          <label className="flex flex-col gap-1 text-sm text-text">
            {t('tags')}
            <input name="tags" placeholder={t('tagsHint')} defaultValue={editing?.tags ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-text">
          {t('content')}
          <textarea name="content" required rows={12} defaultValue={editing?.content ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 font-mono text-xs text-text focus:border-primary outline-none resize-y" />
          <span className="text-[11px] text-muted">{t('contentHint')}</span>
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded border border-border px-4 py-2 text-sm text-muted hover:bg-bg-subtle">{tc('cancel')}</button>
          <button type="submit" disabled={pending} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">{tc('save')}</button>
        </div>
      </form>
    </div>
  );
}

function VersionsModal({
  asset, onClose, onRolledBack,
}: {
  asset: KnowledgeAssetResponse;
  onClose: () => void;
  onRolledBack: (updated: KnowledgeAssetResponse) => void;
}) {
  const t = useTranslations('knowledge');
  const tc = useTranslations('common');
  const { data, isLoading, error } = useQuery({
    queryKey: ['knowledge-versions', asset.id],
    queryFn: () => knowledgeApi.versions(asset.id),
  });
  const rollbackMut = useMutation({
    mutationFn: (versionId: number) => knowledgeApi.rollback(asset.id, versionId),
    onSuccess: (updated) => onRolledBack(updated),
  });
  const versions = Array.isArray(data) ? data : [];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl border border-border bg-panel shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-text">{t('versionsTitle')}</h2>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg-subtle" aria-label={tc('close')}><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <p className="py-6 text-center text-sm text-muted">{tc('loading')}</p>}
          {error && <p className="py-6 text-center text-sm text-danger">{apiErrorMessage(error, tc('errorBody'))}</p>}
          {!isLoading && !error && versions.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('noVersions')}</p>}
          <ul className="flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">v{v.versionNumber} · <span className="font-normal text-muted">{v.title}</span></p>
                  <p className="text-xs text-muted">{fmtDate(v.createdAt)}</p>
                </div>
                <Can permission="knowledge.rollback">
                  <button
                    disabled={rollbackMut.isPending}
                    onClick={() => rollbackMut.mutate(v.id)}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted hover:border-primary hover:text-primary disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> {t('rollback')}
                  </button>
                </Can>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
