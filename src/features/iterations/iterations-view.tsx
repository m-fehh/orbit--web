'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { iterationsApi } from '@/shared/api/endpoints';
import type { IterationResponse, CreateIterationRequest, UpdateIterationRequest } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { cn } from '@/shared/lib/utils';

const STATUS_BADGE: Record<string, { className: string }> = {
  Planning: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  Active: { className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  Completed: { className: 'bg-primary/10 text-primary' },
  Cancelled: { className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' },
};

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.Planning;
  return (
    <span className={cn('inline-block rounded-full px-2.5 py-0.5 text-xs font-medium', badge.className)}>
      {status}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString();
}

export function IterationsView() {
  const t = useTranslations('iterations');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<IterationResponse | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['iterations', page, pageSize, statusFilter],
    queryFn: () => iterationsApi.list(page, pageSize, statusFilter),
  });

  const items = Array.isArray(data) ? data : [];

  const createMut = useMutation({
    mutationFn: (body: CreateIterationRequest) => iterationsApi.create(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iterations'] }); setShowForm(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateIterationRequest }) => iterationsApi.update(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['iterations'] }); setEditing(null); setShowForm(false); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => iterationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['iterations'] }),
  });

  const columns = useMemo<ColumnDef<IterationResponse>[]>(() => [
    { field: 'name', header: t('name'), width: 200 },
    { field: 'goal', header: t('goal'), width: 250, render: (v) => v ?? '—' },
    { field: 'startDate', header: t('startDate'), width: 120, render: (v) => fmtDate(v) },
    { field: 'endDate', header: t('endDate'), width: 120, render: (v) => fmtDate(v) },
    {
      field: 'status', header: t('status'), width: 130,
      filterable: true, filterType: 'select',
      filterOptions: ['Planning', 'Active', 'Completed', 'Cancelled'].map((s) => ({ label: s, value: s })),
      render: (v) => <StatusBadge status={v} />,
    },
    { field: 'ticketCount', header: t('ticketCount'), width: 100, align: 'center' },
  ], [t]);

  const handleRowClick = useCallback((row: IterationResponse) => {
    setEditing(row);
    setShowForm(true);
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = fd.get('name') as string;
    const goal = (fd.get('goal') as string) || null;
    const startDate = fd.get('startDate') as string;
    const endDate = fd.get('endDate') as string;

    if (editing) {
      const status = fd.get('status') as string;
      updateMut.mutate({ id: editing.id, body: { name, goal, startDate, endDate, status } });
    } else {
      createMut.mutate({ name, goal, startDate, endDate });
    }
  }, [editing, createMut, updateMut]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-text">{t('title')}</h1>
      </div>

      <DataGrid<IterationResponse>
        gridId="iterations"
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
            {t('newIteration')}
          </button>
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-border bg-panel p-6 shadow-xl flex flex-col gap-4"
          >
            <h2 className="text-lg font-semibold text-text">{editing ? t('name') : t('newIteration')}</h2>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('name')}
              <input name="name" required defaultValue={editing?.name ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('goal')}
              <textarea name="goal" rows={3} defaultValue={editing?.goal ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none resize-none" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-text">
                {t('startDate')}
                <input name="startDate" type="date" required defaultValue={editing?.startDate?.slice(0, 10) ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-text">
                {t('endDate')}
                <input name="endDate" type="date" required defaultValue={editing?.endDate?.slice(0, 10) ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
              </label>
            </div>

            {editing && (
              <label className="flex flex-col gap-1 text-sm text-text">
                {t('status')}
                <select name="status" defaultValue={editing.status} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none">
                  {['Planning', 'Active', 'Completed', 'Cancelled'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
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
