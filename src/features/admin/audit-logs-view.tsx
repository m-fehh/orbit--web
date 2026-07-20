'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, ChevronRight, ArrowRight, X } from 'lucide-react';
import { auditApi, usersApi, type AuditLogQuery } from '@/shared/api/endpoints';
import type { AuditLogResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
import { DateRangePicker, type DateRange } from '@/shared/ui/date-range-picker';
import { type ComboOption } from '@/shared/ui/async-combobox';
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

const ACTIONS = ['Insert', 'Update', 'Delete', 'SoftDelete', 'Restore'];

// Entidades auditáveis mais comuns (para o filtro por entidade).
const ENTITIES = [
  'Ticket', 'TicketComment', 'Worklog', 'RootCause', 'Resolution', 'Investigation',
  'KnowledgeAsset', 'Problem', 'Playbook', 'SlaPolicy', 'Iteration', 'Tag',
  'User', 'Team', 'ProfileGroup', 'AccessRule', 'ChatMessage', 'EngineeringWorkItem',
];

// Campos cujo valor é um id de usuário — resolvidos para o nome legível.
const USER_ID_FIELDS = new Set([
  'AssignedUserId', 'CustomerId', 'ResolvedById', 'ValidatedById', 'UserId', 'AuthorId', 'CreatedByUserId',
]);

/** "Audit_TicketCreated" → "Ticket Created" (fallback legível quando não há i18n). */
function humanizeKey(key: string | null | undefined): string {
  if (!key) return '';
  return key.replace(/^Audit_?/, '').replace(/[._]/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

const csvEsc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function AuditLogsView() {
  const t = useTranslations('auditLogs');
  const tr = useTranslations();
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(30);
  const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });
  const [entityName, setEntityName] = useState('');
  const [action, setAction] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [entityId, setEntityId] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  // Filtros efetivos enviados ao servidor (o back suporta todos).
  const filters = useMemo<AuditLogQuery>(() => ({
    ...(entityName ? { entityName } : {}),
    ...(action ? { action } : {}),
    ...(userId ? { userId } : {}),
    ...(entityId && /^\d+$/.test(entityId) ? { entityId: Number(entityId) } : {}),
    ...(dateRange.from ? { from: dateRange.from } : {}),
    ...(dateRange.to ? { to: dateRange.to } : {}),
  }), [entityName, action, userId, entityId, dateRange]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['audit', 'list', page, pageSize, filters],
    queryFn: () => auditApi.list({ page, pageSize, ...filters }),
  });

  const usersQuery = useQuery({ queryKey: ['users', 'options', 200], queryFn: () => usersApi.list(1, 200) });
  const userName = useMemo(() => {
    const map = new Map<number, string>((usersQuery.data?.items ?? []).map((u) => [u.id, u.name]));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [usersQuery.data]);
  const userOptions: ComboOption[] = (usersQuery.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));

  const items = data?.items ?? [];
  const hasFilters = !!(entityName || action || userId || entityId || dateRange.from || dateRange.to);

  const label = (dict: 'entities' | 'fields' | 'actions', key: string) =>
    t.has(`${dict}.${key}`) ? t(`${dict}.${key}`) : key;

  // Descrição do evento: traduz por chave (Audit_TicketCreated → descriptions.TicketCreated),
  // caindo para o humanizador legível quando não houver tradução.
  const describe = (key: string | null | undefined): string => {
    if (!key) return '';
    const short = key.replace(/^Audit_?/, '');
    return t.has(`descriptions.${short}`) ? t(`descriptions.${short}`) : humanizeKey(key);
  };

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

  const clearFilters = () => {
    setEntityName(''); setAction(''); setUserId(null); setEntityId('');
    setDateRange({ from: null, to: null }); setPage(1);
  };

  // Exporta o conjunto FILTRADO (até 200) como CSV — sobrepõe o export da página.
  const exportCsv = async () => {
    const res = await auditApi.list({ page: 1, pageSize: 200, ...filters });
    const head = [t('colWhen'), t('colAction'), t('colWhat'), t('colUser'), t('colDescription'), t('changes')];
    const rows = (res.items ?? []).map((r) => [
      formatDateTime(r.occurredAt, { locale, timeZone }),
      label('actions', r.action),
      `${label('entities', r.entityName)} #${r.entityId}`,
      r.userName ?? '',
      describe(r.descriptionKey),
      (r.fields ?? []).map((f) => `${label('fields', f.fieldName)}: ${humanizeValue(f.fieldName, f.oldValue)} → ${humanizeValue(f.fieldName, f.newValue)}`).join(' | '),
    ].map((c) => csvEsc(String(c))).join(','));
    const blob = new Blob(['﻿' + [head.map(csvEsc).join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `auditoria-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const columns: ColumnDef<AuditLogResponse>[] = useMemo(() => [
    {
      field: 'occurredAt',
      header: t('colWhen'),
      sortable: true,
      width: 170,
      render: (v) => <span className="whitespace-nowrap text-xs text-muted">{formatDateTime(v, { locale, timeZone })}</span>,
    },
    {
      field: 'action',
      header: t('colAction'),
      sortable: true,
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
        <span className="block">
          <span className="text-sm">
            <span className="font-medium text-text">{label('entities', row.entityName)}</span>
            <span className="ml-1 text-xs text-dim">#{row.entityId}</span>
          </span>
          {row.descriptionKey && <span className="block text-[11px] text-muted">{describe(row.descriptionKey)}</span>}
        </span>
      ),
    },
    {
      field: 'userName',
      header: t('colUser'),
      sortable: true,
      width: 180,
      render: (v) => <span className="text-xs text-muted">{v ?? '—'}</span>,
    },
    {
      field: 'fields',
      header: '',
      width: 36,
      render: (_v, row) => row.fields?.length > 0 ? (
        <ChevronRight className={cn('h-3.5 w-3.5 text-dim transition-transform duration-200', expanded === row.id && 'rotate-90 text-primary')} />
      ) : null,
    },
  ], [t, tr, locale, timeZone, expanded, userName]);

  const selectCls = 'h-9 rounded-lg border border-border bg-bg-subtle px-2.5 text-xs text-text outline-none focus:border-primary';

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
        onRowClick={(row) => { if (row.fields?.length > 0) setExpanded(expanded === row.id ? null : row.id); }}
        onRefresh={() => refetch()}
        onExport={exportCsv}
        loading={isLoading}
        error={isError ? t('loadError') : null}
        emptyMessage={t('empty')}
        emptyIcon={ScrollText}
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <select value={entityName} onChange={(e) => { setEntityName(e.target.value); setPage(1); }} className={cn(selectCls, 'w-40')} aria-label={t('filterEntity')}>
              <option value="">{t('allEntities')}</option>
              {ENTITIES.map((n) => <option key={n} value={n}>{label('entities', n)}</option>)}
            </select>
            <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className={cn(selectCls, 'w-36')} aria-label={t('filterAction')}>
              <option value="">{t('allActions')}</option>
              {ACTIONS.map((a) => <option key={a} value={a}>{label('actions', a)}</option>)}
            </select>
            <select value={userId ?? ''} onChange={(e) => { setUserId(e.target.value ? Number(e.target.value) : null); setPage(1); }} className={cn(selectCls, 'w-44')} aria-label={t('filterUser')}>
              <option value="">{t('filterUser')}</option>
              {userOptions.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
            </select>
            <input value={entityId} onChange={(e) => { setEntityId(e.target.value.replace(/\D/g, '')); setPage(1); }} placeholder={t('entityIdPh')} className={cn(selectCls, 'w-24')} />
            <DateRangePicker value={dateRange} onChange={(r) => { setDateRange(r); setPage(1); }} />
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2.5 text-xs text-muted hover:bg-panel-2 hover:text-text">
                <X className="h-3.5 w-3.5" /> {t('clearFilters')}
              </button>
            )}
          </div>
        }
      />

      {/* Detalhe legível das mudanças (diff antes/depois) */}
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
