'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { iterationsApi } from '@/shared/api/endpoints';
import type { IterationResponse } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { Button } from '@/shared/ui/button';
import { cn } from '@/shared/lib/utils';
import { openIterationWindow } from './iteration-actions';

const STATUS_BADGE: Record<string, { className: string }> = {
  Planning: { className: 'bg-blue-500/10 text-blue-600' },
  Active: { className: 'bg-emerald-500/10 text-emerald-600' },
  Completed: { className: 'bg-primary/10 text-primary' },
  Cancelled: { className: 'bg-slate-400/10 text-slate-400' },
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.Planning;
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold', badge.className)}>
      {label}
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

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['iterations', page, pageSize],
    queryFn: () => iterationsApi.list(page, pageSize),
  });

  const items = Array.isArray(data) ? data : [];

  const statusMap: Record<string, string> = {
    Planning: t('planning'),
    Active: t('active'),
    Completed: t('completed'),
    Cancelled: t('cancelled'),
  };

  const columns = useMemo<ColumnDef<IterationResponse>[]>(() => [
    { field: 'name', header: t('name'), width: 200, sortable: true },
    { field: 'goal', header: t('goal'), width: 250, render: (v) => v ?? '—' },
    { field: 'startDate', header: t('startDate'), width: 120, render: (v) => fmtDate(v) },
    { field: 'endDate', header: t('endDate'), width: 120, render: (v) => fmtDate(v) },
    {
      field: 'status', header: t('status'), width: 130,
      filterable: true, filterType: 'select',
      filterOptions: ['Planning', 'Active', 'Completed', 'Cancelled'].map((s) => ({ label: statusMap[s] ?? s, value: s })),
      render: (v) => <StatusBadge status={v} label={statusMap[v] ?? v} />,
    },
    { field: 'ticketCount', header: t('ticketCount'), width: 100, align: 'center' },
  ], [t, statusMap]);

  const handleRowClick = useCallback((row: IterationResponse) => openIterationWindow(row), []);

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
          <Button size="sm" onClick={() => openIterationWindow()}>
            <Plus className="h-3.5 w-3.5" />
            {t('newIteration')}
          </Button>
        }
      />
    </div>
  );
}
