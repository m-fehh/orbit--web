'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Search } from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import type { KnowledgeAssetResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { useTabStore } from '@/features/workspace/tab-store';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DataGrid, type ColumnDef, type DataGridLabels } from '@/shared/ui/data-grid';
import { useDataGridQuery, type DataGridQueryParams } from '@/shared/ui/use-data-grid-query';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildApiParams(params: DataGridQueryParams) {
  const apiParams: Record<string, unknown> = {
    page: params.page,
    pageSize: params.pageSize,
  };
  if (params.search) apiParams.search = params.search;
  if (params.sort.length > 0) {
    apiParams.sortBy = params.sort[0].field;
    apiParams.sortDirection = params.sort[0].direction;
  }
  return apiParams;
}

function statusLabel(row: KnowledgeAssetResponse): 'published' | 'draft' | 'archived' {
  // The API doesn't have an explicit archived flag yet, so we infer from isPublished
  return row.isPublished ? 'published' : 'draft';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KnowledgeView() {
  const locale = useLocale() as Locale;
  const t = useTranslations('knowledge');
  const tGrid = useTranslations('dataGrid');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const openTab = useTabStore((s) => s.openTab);

  const grid = useDataGridQuery<KnowledgeAssetResponse>({
    queryKey: ['knowledge', 'list'],
    queryFn: (params) => knowledgeApi.list(buildApiParams(params) as any),
    defaultPageSize: 20,
    defaultSorts: [{ field: 'updatedAt', direction: 'desc' }],
  });

  const columns = useMemo<ColumnDef<KnowledgeAssetResponse>[]>(
    () => [
      {
        field: 'title',
        header: t('title'),
        width: 300,
        minWidth: 180,
        sortable: true,
        sticky: 'left',
        cellClassName: 'max-w-[300px] truncate font-medium',
      },
      {
        field: 'summary',
        header: t('summary'),
        width: 320,
        minWidth: 150,
        cellClassName: 'max-w-[320px] truncate',
        render: (val: string) => (
          <span className="text-xs text-muted">{val || '—'}</span>
        ),
      },
      {
        field: 'isPublished',
        header: 'Status',
        width: 120,
        minWidth: 100,
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { label: t('statusPublished'), value: 'published' },
          { label: t('statusDraft'), value: 'draft' },
        ],
        render: (_val: boolean, row: KnowledgeAssetResponse) => {
          const s = statusLabel(row);
          return (
            <span
              className={
                s === 'published'
                  ? 'inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              }
            >
              {s === 'published' ? t('statusPublished') : t('statusDraft')}
            </span>
          );
        },
      },
      {
        field: 'reuseCount',
        header: t('reuseCount'),
        width: 110,
        minWidth: 80,
        sortable: true,
        align: 'center',
        render: (val: number) => (
          <span className="text-xs font-mono">{val}</span>
        ),
      },
      {
        field: 'rootCauseId',
        header: t('rootCause'),
        width: 120,
        minWidth: 80,
        render: (val: number | null) => (
          <span className="text-xs text-muted">{val ? `#${val}` : '—'}</span>
        ),
      },
      {
        field: 'createdAt',
        header: t('createdAt'),
        width: 160,
        minWidth: 130,
        sortable: true,
        render: (val: string | null) => (
          <span className="text-xs text-muted">
            {val ? formatDateTime(val, { locale, timeZone }) : '—'}
          </span>
        ),
      },
      {
        field: 'updatedAt',
        header: t('updatedAt'),
        width: 160,
        minWidth: 130,
        sortable: true,
        render: (val: string | null) => (
          <span className="text-xs text-muted">
            {val ? formatDateTime(val, { locale, timeZone }) : '—'}
          </span>
        ),
      },
    ],
    [t, locale, timeZone],
  );

  const labels = useMemo<Partial<DataGridLabels>>(
    () => ({
      showing: tGrid('showing'),
      of: tGrid('of'),
      noData: tGrid('noData'),
      loading: tGrid('loading'),
      errorDefault: tGrid('errorDefault'),
      retry: tGrid('retry'),
      refresh: tGrid('refresh'),
      exportCsv: tGrid('exportCsv'),
      page: tGrid('page'),
      pageSize: tGrid('pageSize'),
      first: tGrid('first'),
      last: tGrid('last'),
      previous: tGrid('previous'),
      next: tGrid('next'),
      selectAll: tGrid('selectAll'),
      selectedCount: tGrid('selectedCount'),
      filterContains: tGrid('filterContains'),
      filterStartsWith: tGrid('filterStartsWith'),
      filterEquals: tGrid('filterEquals'),
      filterFrom: tGrid('filterFrom'),
      filterTo: tGrid('filterTo'),
      filterApply: tGrid('filterApply'),
      filterClear: tGrid('filterClear'),
    }),
    [tGrid],
  );

  const handleRowClick = (row: KnowledgeAssetResponse) => {
    openTab({
      kind: 'knowledge-article',
      params: { id: row.id },
      title: row.title,
      icon: 'knowledge',
    });
  };

  const handleNewArticle = () => {
    openTab({
      kind: 'knowledge-article',
      params: { id: 'new' },
      title: t('newArticle'),
      icon: 'knowledge',
    });
  };

  const toolbar = (
    <>
      <div className="relative w-64 max-w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={grid.search}
          onChange={(e) => grid.setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className=" h-8 text-xs"
        />
      </div>
      <Can permission="knowledge.create">
        <Button size="sm" onClick={handleNewArticle}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('newArticle')}
        </Button>
      </Can>
    </>
  );

  return (
    <div className="flex h-full flex-col p-md gap-md">
      <div>
        <h1 className="text-lg font-bold">{t('pageTitle')}</h1>
        <p className="text-xs text-muted">
          {grid.totalCount > 0
            ? `${grid.totalCount} ${t('articlesCount')}`
            : grid.isLoading
              ? '...'
              : '—'}
        </p>
      </div>

      <DataGrid<KnowledgeAssetResponse>
        gridId="knowledge-center"
        columns={columns}
        data={grid.data}
        rowKey="id"
        totalCount={grid.totalCount}
        page={grid.page}
        pageSize={grid.pageSize}
        onPageChange={grid.onPageChange}
        onPageSizeChange={grid.onPageSizeChange}
        onSortChange={grid.onSortChange}
        onFilterChange={grid.onFilterChange}
        onRefresh={grid.onRefresh}
        onRowClick={handleRowClick}
        loading={grid.isLoading}
        error={grid.error}
        toolbar={toolbar}
        labels={labels}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
