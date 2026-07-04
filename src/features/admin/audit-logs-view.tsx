'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, ChevronRight, ArrowRight } from 'lucide-react';
import { auditApi, usersApi } from '@/shared/api/endpoints';
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

// Campos cujo valor é um id de usuário — resolvidos para o nome legível.
const USER_ID_FIELDS = new Set([
  'AssignedUserId', 'CustomerId', 'ResolvedById', 'ValidatedById', 'UserId', 'AuthorId', 'CreatedByUserId',
]);

export function AuditLogsView() {
  const t = useTranslations('auditLogs');
  const tr = useTranslations();
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

  const usersQuery = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 200) });
  const userName = useMemo(() => {
    const map = new Map<number, string>((usersQuery.data?.items ?? []).map((u) => [u.id, u.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [usersQuery.data]);

  const items = data?.items ?? [];

  // ── Humanização ────────────────────────────────────────────────────────────
  const label = (dict: 'entities' | 'fields' | 'actions', key: string) =>
    t.has(`${dict}.${key}`) ? t(`${dict}.${key}`) : key;

  const humanizeValue = (field: string, value: string | null): string => {
    if (value == null || value === '') return '—';
    if (field === 'Status' && tr.has(`ticketStatus.${value}`)) return tr(`ticketStatus.${value}`);
    if (field === 'Priority' && tr.has(`priority.${value}`)) return tr(`priority.${value}`);
    if (value === 'True' || value === 'true') return t('yes');
    if (value === 'False' || value === 'false') return t('no');
    if (USER_ID_FIELDS.has(field) && /^\d+$/.test(value)) return userName(Number(value));
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value, { locale, timeZone });
    return value;
  };

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
        { label: label('actions', 'Insert'), value: 'Insert' },
        { label: label('actions', 'Update'), value: 'Update' },
        { label: label('actions', 'Delete'), value: 'Delete' },
        { label: label('actions', 'SoftDelete'), value: 'SoftDelete' },
        { label: label('actions', 'Restore'), value: 'Restore' },
      ],
      width: 120,
      render: (v: string) => (
        <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold', ACTION_STYLE[v] ?? 'bg-panel-2 text-muted')}>
          {label('actions', v)}
        </span>
      ),
    },
    {
      field: 'entityName',
      header: t('colWhat'),
      sortable: true,
      render: (_v, row) => (
        <span className="text-sm">
          <span className="font-medium text-text">{label('entities', row.entityName)}</span>
          <span className="ml-1 text-xs text-dim">#{row.entityId}</span>
        </span>
      ),
    },
    {
      field: 'userName',
      header: t('colUser'),
      sortable: true,
      width: 180,
      render: (v) => <span className="text-xs text-muted">{v ?? t('colUser')}</span>,
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
  ], [t, tr, locale, timeZone, expanded, userName]);

  const handleDateChange = (range: DateRange) => {
    setDateRange(range);
    setPage(1);
  };

  return (
    <PageTransition className="flex h-full flex-col gap-lg p-lg">
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

      {/* Detalhe legível das mudanças */}
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
              <div className="grid gap-1.5">
                {row.fields.map((f) => (
                  <div key={f.fieldName} className="flex flex-wrap items-center gap-2 rounded border border-border/40 bg-bg-subtle/50 px-3 py-1.5 text-xs">
                    <strong className="min-w-[130px] shrink-0 text-text">{label('fields', f.fieldName)}</strong>
                    <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through">{humanizeValue(f.fieldName, f.oldValue)}</span>
                    <ArrowRight className="h-3 w-3 shrink-0 text-dim" aria-hidden />
                    <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{humanizeValue(f.fieldName, f.newValue)}</span>
                  </div>
                ))}
              </div>

              {/* Contexto técnico — recolhido no rodapé, para auditoria/compliance */}
              {(row.origin || row.ipAddress || row.correlationId) && (
                <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-dim">
                  <span className="font-semibold uppercase tracking-wide">{t('techDetails')}:</span>
                  {row.origin && <span className="font-mono">{row.origin}</span>}
                  {row.ipAddress && <span>IP {row.ipAddress}</span>}
                  {row.correlationId && <span>{t('correlation')} <span className="font-mono">{row.correlationId}</span></span>}
                </p>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
