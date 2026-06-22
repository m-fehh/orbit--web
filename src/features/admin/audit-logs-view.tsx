'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, ChevronRight, ArrowRight, Hash } from 'lucide-react';
import { auditApi } from '@/shared/api/endpoints';
import type { AuditLogResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
import { DateRangePicker, type DateRange } from '@/shared/ui/date-range-picker';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { cn } from '@/shared/lib/utils';

const ACTION_STYLE: Record<string, string> = {
  Insert: 'bg-success/15 text-success',
  Update: 'bg-info/15 text-info',
  Delete: 'bg-danger/15 text-danger',
  SoftDelete: 'bg-warning/15 text-warning',
  Restore: 'bg-primary-soft text-primary',
};

export function AuditLogsView() {
  const t = useTranslations('auditLogs');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', 'list', page, pageSize, dateRange],
    queryFn: () => auditApi.list({
      page,
      pageSize,
      ...(dateRange.from ? { from: dateRange.from } : {}),
      ...(dateRange.to ? { to: dateRange.to } : {}),
    }),
  });

  const items = data?.items ?? [];

  const columns: ColumnDef<AuditLogResponse>[] = useMemo(() => [
    {
      field: 'occurredAt',
      header: t('colWhen'),
      sortable: true,
      width: 170,
      render: (v) => (
        <span className="whitespace-nowrap text-xs text-muted">
          {formatDateTime(v, { locale, timeZone })}
        </span>
      ),
    },
    {
      field: 'action',
      header: t('colAction'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Insert', value: 'Insert' },
        { label: 'Update', value: 'Update' },
        { label: 'Delete', value: 'Delete' },
        { label: 'SoftDelete', value: 'SoftDelete' },
        { label: 'Restore', value: 'Restore' },
      ],
      width: 110,
      render: (v: string) => (
        <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold uppercase', ACTION_STYLE[v] ?? 'bg-panel-2 text-muted')}>
          {v}
        </span>
      ),
    },
    {
      field: 'entityName',
      header: t('colEntity'),
      sortable: true,
      filterable: true,
      filterType: 'text',
      width: 200,
      render: (_v, row) => (
        <span>
          <span className="font-medium">{row.entityName}</span>
          <span className="ml-1 font-mono text-xs text-dim">#{row.entityId}</span>
        </span>
      ),
    },
    {
      field: 'userName',
      header: t('colUser'),
      sortable: true,
      width: 150,
      render: (v) => <span className="text-xs text-muted">{v ?? '—'}</span>,
    },
    {
      field: 'ipAddress',
      header: t('colIp'),
      width: 130,
      render: (v) => <span className="font-mono text-xs text-dim">{v ?? '—'}</span>,
    },
    {
      field: 'origin',
      header: t('colOrigin'),
      width: 100,
      render: (v) => <span className="text-xs text-dim">{v ?? '—'}</span>,
    },
    {
      field: 'fields',
      header: '',
      width: 36,
      render: (_v, row) => row.fields?.length > 0 ? (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-dim transition-transform duration-200',
            expanded === row.id && 'rotate-90 text-primary',
          )}
        />
      ) : null,
    },
  ], [t, locale, timeZone, expanded]);

  const handleDateChange = (range: DateRange) => {
    setDateRange(range);
    setPage(1);
  };

  return (
    <PageTransition className="flex h-full flex-col">
      <DataGrid<AuditLogResponse>
        gridId="admin-audit-logs"
        columns={columns}
        data={items}
        rowKey="id"
        totalCount={data?.totalCount ?? 0}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        onRowClick={(row) => {
          if (row.fields?.length > 0) {
            setExpanded(expanded === row.id ? null : row.id);
          }
        }}
        onRefresh={() => refetch()}
        loading={isLoading}
        error={isError ? t('loadError') : null}
        emptyMessage={t('empty')}
        emptyIcon={ScrollText}
        toolbar={
          <DateRangePicker value={dateRange} onChange={handleDateChange} />
        }
      />

      {/* Expanded field detail */}
      <AnimatePresence>
        {expanded != null && (() => {
          const row = items.find((r) => r.id === expanded);
          if (!row || row.fields.length === 0) return null;
          return (
            <motion.div
              key={expanded}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="border-t border-border bg-panel-2/30 px-lg py-sm"
            >
              {row.correlationId && (
                <div className="mb-2 flex items-center gap-1 text-[10px] text-dim">
                  <Hash className="h-3 w-3" />
                  <span className="font-mono">{row.correlationId}</span>
                </div>
              )}
              <div className="grid gap-1.5">
                {row.fields.map((f) => (
                  <div key={f.fieldName} className="flex items-start gap-2 rounded border border-border/40 bg-bg-subtle/50 px-3 py-1.5 text-xs">
                    <strong className="min-w-[120px] shrink-0 text-text">{f.fieldName}</strong>
                    <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through">{f.oldValue ?? '—'}</span>
                    <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-dim" aria-hidden />
                    <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{f.newValue ?? '—'}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
