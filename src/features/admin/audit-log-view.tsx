'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { auditApi } from '@/shared/api/endpoints';
import type { AuditLogResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { cn } from '@/shared/lib/utils';

const ACTION_COLOR: Record<AuditLogResponse['action'], string> = {
  Insert: 'bg-success/15 text-success',
  Update: 'bg-info/15 text-info',
  Delete: 'bg-danger/15 text-danger',
  SoftDelete: 'bg-warning/15 text-warning',
  Restore: 'bg-primary/15 text-primary',
};

export function AuditLogView() {
  const t = useTranslations('admin.audit');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [entityName, setEntityName] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const gridLabels = useDataGridLabels();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', 'admin', page, pageSize, entityName],
    queryFn: () => auditApi.list({ page, pageSize, entityName: entityName || undefined }),
  });

  const items = data?.items ?? [];

  const columns: ColumnDef<AuditLogResponse>[] = useMemo(() => [
    {
      field: 'occurredAt',
      header: t('when'),
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
      header: t('action'),
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
      render: (v: AuditLogResponse['action']) => (
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-medium', ACTION_COLOR[v])}>
          {v}
        </span>
      ),
    },
    {
      field: 'entityName',
      header: t('entity'),
      sortable: true,
      filterable: true,
      filterType: 'text',
      width: 200,
      render: (_v, row) => (
        <span className="font-mono text-xs">{row.entityName} #{row.entityId}</span>
      ),
    },
    {
      field: 'userName',
      header: t('user'),
      sortable: true,
      width: 160,
      render: (v) => <span className="text-xs">{v ?? '—'}</span>,
    },
    {
      field: 'origin',
      header: t('origin'),
      width: 100,
      render: (v) => <span className="text-xs text-dim">{v ?? '—'}</span>,
    },
    {
      field: 'fields',
      header: '',
      width: 40,
      render: (_v, row) => row.fields?.length > 0 ? (
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 text-dim transition-transform',
            expanded === row.id && 'rotate-90 text-primary',
          )}
        />
      ) : null,
    },
  ], [t, locale, timeZone, expanded]);

  return (
    <PageTransition className="flex h-full flex-col">
      <DataGrid<AuditLogResponse>
        gridId="admin-audit"
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
        emptyIcon={ClipboardList}
        labels={gridLabels}
      />

      {/* Expanded field detail overlay (rendered outside DataGrid for flexibility) */}
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
              className="border-t border-border bg-panel/50 px-lg py-sm"
            >
              <p className="mb-sm text-[10px] font-semibold uppercase tracking-wide text-dim">
                {t('colField')} — {row.entityName} #{row.entityId}
              </p>
              <div className="overflow-auto rounded border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-bg-subtle text-dim">
                    <tr>
                      <th className="px-md py-1.5 text-left font-semibold">{t('colField')}</th>
                      <th className="px-md py-1.5 text-left font-semibold">{t('colFrom')}</th>
                      <th className="px-md py-1.5 text-left font-semibold">{t('colTo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.fields.map((f, j) => (
                      <tr key={j} className="border-t border-border/50">
                        <td className="px-md py-1 font-mono">{f.fieldName}</td>
                        <td className="px-md py-1 text-muted">{f.oldValue ?? '∅'}</td>
                        <td className="px-md py-1 text-text">{f.newValue ?? '∅'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </PageTransition>
  );
}
