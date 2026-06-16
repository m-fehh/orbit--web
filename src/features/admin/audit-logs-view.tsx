'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { ScrollText, ChevronLeft, ChevronRight, RefreshCw, Search, ArrowRight } from 'lucide-react';
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

/** Consulta ao log de auditoria (somente leitura — gerado pelo AuditInterceptor). */
export function AuditLogsView() {
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const pageSize = 30;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['audit', 'list', page],
    queryFn: () => auditApi.list({ page, pageSize }),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter(
      (l) =>
        l.entityName.toLowerCase().includes(q) ||
        (l.userName ?? '').toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q),
    );
  }, [data, term]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">Logs de auditoria</h1>
          <p className="text-xs text-muted">{data ? `${data.totalCount} registros` : '—'} · somente leitura</p>
        </div>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Filtrar por entidade, usuário, ação…" className="pl-9" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar">
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState label="Carregando auditoria…" />
        ) : isError ? (
          <ErrorState title="Erro ao carregar" onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : items.length === 0 ? (
          <EmptyState icon={ScrollText} message="Nenhum registro de auditoria." />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">Quando</th>
                <th className="px-md py-2 font-semibold">Ação</th>
                <th className="px-md py-2 font-semibold">Entidade</th>
                <th className="px-md py-2 font-semibold">Usuário</th>
                <th className="px-md py-2 font-semibold">Origem</th>
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
          <span className="text-muted">Página {page} de {totalPages}</span>
          <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima">
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
        <td className="px-md py-2.5 text-dim">{log.origin ?? '—'}</td>
      </tr>
      {expanded && hasFields && (
        <tr className="border-t border-border/40 bg-panel-2/30">
          <td colSpan={5} className="px-md py-2">
            <ul className="flex flex-col gap-1 text-xs">
              {log.fields.map((f) => (
                <li key={f.fieldName} className="flex flex-wrap items-center gap-1">
                  <strong className="text-text">{f.fieldName}</strong>:
                  <span className="text-dim line-through">{f.oldValue ?? '—'}</span>
                  <ArrowRight className="h-3 w-3 text-dim" aria-hidden />
                  <span className="text-text">{f.newValue ?? '—'}</span>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
