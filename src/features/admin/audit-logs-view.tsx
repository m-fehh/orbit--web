'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ScrollText, ChevronLeft, ChevronRight, RefreshCw, Search, ArrowRight, Globe, Hash, Calendar } from 'lucide-react';
import { auditApi } from '@/shared/api/endpoints';
import type { AuditLogResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { Input } from '@/shared/ui/input';
import { Button } from '@/shared/ui/button';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
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
  const [entityName, setEntityName] = useState('');
  const [action, setAction] = useState('');
  const [userName, setUserName] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const pageSize = 30;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['audit', 'list', page, entityName, action, userName, dateFrom, dateTo],
    queryFn: () => auditApi.list({
      page,
      pageSize,
      ...(entityName.trim() ? { entityName: entityName.trim() } : {}),
      ...(action ? { action } : {}),
      ...(userName.trim() ? { userId: undefined } : {}),
      ...(dateFrom ? { from: dateFrom } : {}),
      ...(dateTo ? { to: dateTo } : {}),
    }),
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border p-md">
        <div className="flex flex-wrap items-center gap-sm">
          <div>
            <h1 className="text-lg font-bold">{t('title')}</h1>
            <p className="text-xs text-muted">{data ? t('recordCount', { count: data.totalCount }) : '—'} · {t('readOnly')}</p>
          </div>
          <div className="ml-auto flex items-center gap-sm">
            <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label={t('refresh')}>
              <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input
            value={entityName}
            onChange={(e) => { setEntityName(e.target.value); setPage(1); }}
            placeholder={t('entity')}
            className="h-8 w-36"
          />
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="h-8 rounded-md border border-border bg-bg-subtle px-2 text-xs text-text outline-none focus:border-primary"
          >
            <option value="">{t('allActions')}</option>
            <option value="Insert">Insert</option>
            <option value="Update">Update</option>
            <option value="Delete">Delete</option>
            <option value="SoftDelete">SoftDelete</option>
            <option value="Restore">Restore</option>
          </select>
          <div className="flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-dim" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-border bg-bg-subtle px-2 text-xs text-text outline-none focus:border-primary"
            />
            <span className="text-dim">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="h-8 rounded-md border border-border bg-bg-subtle px-2 text-xs text-text outline-none focus:border-primary"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState label={t('loading')} />
        ) : isError ? (
          <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />
        ) : items.length === 0 ? (
          <EmptyState icon={ScrollText} message={t('empty')} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">{t('colWhen')}</th>
                <th className="px-md py-2 font-semibold">{t('colAction')}</th>
                <th className="px-md py-2 font-semibold">{t('colEntity')}</th>
                <th className="px-md py-2 font-semibold">{t('colUser')}</th>
                <th className="px-md py-2 font-semibold">{t('colIp')}</th>
                <th className="px-md py-2 font-semibold">{t('colOrigin')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <AuditRow key={l.id} log={l} locale={locale} timeZone={timeZone} expanded={expanded === l.id} onToggle={() => setExpanded(expanded === l.id ? null : l.id)} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-sm border-t border-border px-md py-2 text-sm">
          <span className="text-muted">{t('pageOf', { page, total: totalPages })}</span>
          <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('previous')}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label={t('next')}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}

function AuditRow({
  log,
  locale,
  timeZone,
  expanded,
  onToggle,
}: {
  log: AuditLogResponse;
  locale: Locale;
  timeZone: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hasFields = log.fields.length > 0;
  return (
    <>
      <tr
        onClick={hasFields ? onToggle : undefined}
        className={cn('border-t border-border/60 transition-colors', hasFields && 'cursor-pointer hover:bg-panel-2/50')}
      >
        <td className="px-md py-2.5 text-muted">{formatDateTime(log.occurredAt, { locale, timeZone })}</td>
        <td className="px-md py-2.5">
          <span className={cn('rounded px-2 py-0.5 text-[11px] font-semibold uppercase', ACTION_STYLE[log.action] ?? 'bg-panel-2 text-muted')}>
            {log.action}
          </span>
        </td>
        <td className="px-md py-2.5">
          <span className="font-medium">{log.entityName}</span>
          <span className="ml-1 font-mono text-xs text-dim">#{log.entityId}</span>
        </td>
        <td className="px-md py-2.5 text-muted">{log.userName ?? '—'}</td>
        <td className="px-md py-2.5 font-mono text-xs text-dim">{log.ipAddress ?? '—'}</td>
        <td className="px-md py-2.5 text-dim">{log.origin ?? '—'}</td>
      </tr>
      {expanded && hasFields && (
        <tr className="border-t border-border/40 bg-panel-2/30">
          <td colSpan={6} className="px-md py-3">
            {log.correlationId && (
              <div className="mb-2 flex items-center gap-1 text-[10px] text-dim">
                <Hash className="h-3 w-3" />
                <span className="font-mono">{log.correlationId}</span>
              </div>
            )}
            <div className="grid gap-1.5">
              {log.fields.map((f) => (
                <div key={f.fieldName} className="flex items-start gap-2 rounded border border-border/40 bg-bg-subtle/50 px-3 py-1.5 text-xs">
                  <strong className="min-w-[120px] shrink-0 text-text">{f.fieldName}</strong>
                  <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger line-through">{f.oldValue ?? '—'}</span>
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-dim" aria-hidden />
                  <span className="rounded bg-success/10 px-1.5 py-0.5 text-success">{f.newValue ?? '—'}</span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
