'use client';

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Search, RefreshCw } from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import type { TicketResponse, TicketStatusName, PriorityName } from '@/shared/api/types';
import { TicketStatus, Priority } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { openNewTicketWindow, openTicketTab } from '@/features/tickets/ticket-actions';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { DataGrid, type ColumnDef, type DataGridLabels } from '@/shared/ui/data-grid';
import { useDataGridQuery, type DataGridQueryParams } from '@/shared/ui/use-data-grid-query';
import { PriorityBadge, StatusBadge } from './badges';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map DataGridQueryParams to the shape ticketsApi.list expects. */
function buildApiParams(params: DataGridQueryParams) {
  const apiParams: Record<string, unknown> = {
    page: params.page,
    pageSize: params.pageSize,
  };

  if (params.search) {
    apiParams.search = params.search;
  }

  // Sort — API accepts sortBy + sortDirection (single sort)
  if (params.sort.length > 0) {
    apiParams.sortBy = params.sort[0].field;
    apiParams.sortDirection = params.sort[0].direction;
  }

  // Filters — map select filters to API params
  const statusFilter = params.filters.status;
  if (statusFilter?.type === 'select' && statusFilter.values.length > 0) {
    apiParams.status = statusFilter.values.join(',');
  }

  const priorityFilter = params.filters.priority;
  if (priorityFilter?.type === 'select' && priorityFilter.values.length > 0) {
    apiParams.priority = priorityFilter.values.join(',');
  }

  return apiParams;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TicketsCentral() {
  const locale = useLocale() as Locale;
  const t = useTranslations('ticket');
  const tGrid = useTranslations('dataGrid');
  const tStatus = useTranslations('ticketStatus');
  const tPriority = useTranslations('priority');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';

  // --- DataGrid query ---
  const grid = useDataGridQuery<TicketResponse>({
    queryKey: ['tickets', 'list'],
    queryFn: (params) => ticketsApi.list(buildApiParams(params) as any),
    defaultPageSize: 20,
    defaultSorts: [{ field: 'openedAt', direction: 'desc' }],
  });

  // --- Status filter options (translated) ---
  const statusOptions = useMemo(
    () =>
      (Object.keys(TicketStatus) as TicketStatusName[]).map((k) => ({
        label: tStatus(k),
        value: k,
      })),
    [tStatus],
  );

  // --- Priority filter options (translated) ---
  const priorityOptions = useMemo(
    () =>
      (Object.keys(Priority) as PriorityName[]).map((k) => ({
        label: tPriority(k),
        value: k,
      })),
    [tPriority],
  );

  // --- Column definitions ---
  const columns = useMemo<ColumnDef<TicketResponse>[]>(
    () => [
      {
        field: 'number',
        header: '#',
        width: 110,
        minWidth: 80,
        sortable: true,
        sticky: 'left',
        render: (val: string) => (
          <span className="font-mono text-xs font-semibold text-primary">{val}</span>
        ),
      },
      {
        field: 'title',
        header: t('titleColumn' as any),
        width: 320,
        minWidth: 180,
        sortable: true,
        cellClassName: 'max-w-[320px] truncate',
      },
      {
        field: 'status',
        header: 'Status',
        width: 150,
        minWidth: 120,
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: statusOptions,
        render: (val: TicketStatusName) => <StatusBadge status={val} />,
      },
      {
        field: 'priority',
        header: t('priorityColumn' as any),
        width: 130,
        minWidth: 100,
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: priorityOptions,
        render: (val: PriorityName) => <PriorityBadge priority={val} />,
      },
      {
        field: 'assignedUserId',
        header: t('assignee'),
        width: 150,
        minWidth: 100,
        sortable: false,
        render: (val: number | null) => (
          <span className="text-xs text-muted">{val ? `#${val}` : '—'}</span>
        ),
      },
      {
        field: 'assignedTeamId',
        header: t('team'),
        width: 120,
        minWidth: 80,
        sortable: false,
        render: (val: number | null) => (
          <span className="text-xs text-muted">{val ? `#${val}` : '—'}</span>
        ),
      },
      {
        field: 'openedAt',
        header: t('openedAt'),
        width: 160,
        minWidth: 130,
        sortable: true,
        render: (val: string) => (
          <span className="text-xs text-muted">
            {formatDateTime(val, { locale, timeZone })}
          </span>
        ),
      },
      {
        field: 'lastUpdateUTC',
        header: t('updatedAt'),
        width: 160,
        minWidth: 130,
        sortable: true,
        render: (val: string | null, row: TicketResponse) => (
          <span className="text-xs text-muted">
            {formatDateTime(val ?? row.openedAt, { locale, timeZone })}
          </span>
        ),
      },
    ],
    [t, tStatus, tPriority, statusOptions, priorityOptions, locale, timeZone],
  );

  // --- Translated labels for DataGrid ---
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

  // --- Row click handler ---
  const handleRowClick = (row: TicketResponse) => {
    openTicketTab({ id: row.id, number: row.number, title: row.title });
  };

  // --- Toolbar ---
  const toolbar = (
    <>
      <div className="relative w-64 max-w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <Input
          value={grid.search}
          onChange={(e) => grid.setSearch(e.target.value)}
          placeholder={t('searchPlaceholder' as any)}
          className=" h-8 text-xs"
        />
      </div>
      <Can permission="ticket.create">
        <Button size="sm" onClick={openNewTicketWindow}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('newTicket' as any)}
        </Button>
      </Can>
    </>
  );

  return (
    <div className="flex h-full flex-col p-md gap-md">
      <div>
        <h1 className="text-lg font-bold">
          {t('center' as any)}
        </h1>
        <p className="text-xs text-muted">
          {grid.totalCount > 0
            ? `${grid.totalCount} tickets`
            : grid.isLoading
              ? '...'
              : '—'}
        </p>
      </div>

      <DataGrid<TicketResponse>
        gridId="tickets-central"
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
