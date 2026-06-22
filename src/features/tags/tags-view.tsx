'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { tagsApi } from '@/shared/api/endpoints';
import type { TagResponse, CreateTagRequest, UpdateTagRequest } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { cn } from '@/shared/lib/utils';

function ColorSwatch({ color }: { color: string | null }) {
  if (!color) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-4 w-4 rounded border border-border" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted">{color}</span>
    </span>
  );
}

function ActiveBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    )}>
      {label}
    </span>
  );
}

export function TagsView() {
  const t = useTranslations('tags');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<TagResponse | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const items = Array.isArray(data) ? data : [];

  const createMut = useMutation({
    mutationFn: (body: CreateTagRequest) => tagsApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateTagRequest }) => tagsApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tags'] }); setEditing(null); setShowForm(false); },
  });

  const deactivateMut = useMutation({
    mutationFn: (id: number) => tagsApi.deactivate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  const columns = useMemo<ColumnDef<TagResponse>[]>(() => [
    { field: 'name', header: t('name'), width: 200 },
    { field: 'color', header: t('color'), width: 160, render: (v) => <ColorSwatch color={v} /> },
    { field: 'group', header: t('group'), width: 160, render: (v) => v ?? '—' },
    {
      field: 'active', header: t('active'), width: 120,
      render: (v) => <ActiveBadge active={v} label={v ? t('active') : t('inactive')} />,
    },
  ], [t]);

  const handleRowClick = useCallback((row: TagResponse) => {
    setEditing(row);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const color = (fd.get('color') as string) || null;
    const group = (fd.get('group') as string) || null;

    if (editing) {
      updateMut.mutate({ id: editing.id, body: { name, color, group } });
    } else {
      createMut.mutate({ name, color, group });
    }
  }, [editing, createMut, updateMut]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">{t('title')}</h1>
      </div>

      <DataGrid<TagResponse>
        gridId="tags"
        columns={columns}
        data={items}
        rowKey="id"
        loading={isLoading}
        error={error ? apiErrorMessage(error, tc('errorBody')) : null}
        onRefresh={() => refetch()}
        onRowClick={handleRowClick}
        toolbar={
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newTag')}
          </button>
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-xl flex flex-col gap-4"
          >
            <h2 className="text-lg font-semibold text-text">{editing ? t('name') : t('newTag')}</h2>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('name')}
              <input name="name" required defaultValue={editing?.name ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('color')}
              <div className="flex items-center gap-2">
                <input name="color" type="text" placeholder="#FF5733" defaultValue={editing?.color ?? ''} className="flex-1 rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
              </div>
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('group')}
              <input name="group" defaultValue={editing?.group ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              {editing && editing.active && (
                <button
                  type="button"
                  onClick={() => { deactivateMut.mutate(editing.id); setShowForm(false); setEditing(null); }}
                  className="mr-auto rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  {t('deactivated').replace('Tag ', '').replace('desativada', 'Desativar').replace('deactivated', 'Deactivate').replace('desactivada', 'Desactivar')}
                </button>
              )}
              <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="rounded border border-border px-4 py-2 text-sm text-muted hover:bg-bg-subtle">
                {tc('cancel')}
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {tc('save')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
