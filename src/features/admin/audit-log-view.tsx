'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react';
import { auditApi } from '@/shared/api/endpoints';
import type { AuditLogResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';

const ACTION_COLOR: Record<AuditLogResponse['action'], string> = {
  Insert: 'bg-success/15 text-success',
  Update: 'bg-info/15 text-info',
  Delete: 'bg-danger/15 text-danger',
  SoftDelete: 'bg-warning/15 text-warning',
  Restore: 'bg-primary/15 text-primary',
};

/** Tela administrativa de Auditoria: filtros básicos + tabela + drill-down de campos. */
export function AuditLogView() {
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [entityName, setEntityName] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const pageSize = 50;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['audit', 'admin', page, entityName],
    queryFn: () => auditApi.list({ page, pageSize, entityName: entityName || undefined }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">Auditoria</h1>
          <p className="text-xs text-muted">{data ? `${data.totalCount} eventos` : '—'}</p>
        </div>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input
            value={entityName}
            onChange={(e) => { setEntityName(e.target.value); setPage(1); }}
            placeholder="Filtrar por entidade (ex.: Ticket)"
            className="pl-9"
          />
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
        ) : !data || data.items.length === 0 ? (
          <EmptyState message="Sem eventos de auditoria para os filtros atuais." />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel text-xs uppercase tracking-wide text-dim">
              <tr>
                <th className="px-md py-2">Quando</th>
                <th className="px-md py-2">Ação</th>
                <th className="px-md py-2">Entidade</th>
                <th className="px-md py-2">Usuário</th>
                <th className="px-md py-2">Origem</th>
              </tr>
            </thead>
            <tbody>
              {data.items.flatMap((row) => {
                const main = (
                  <tr
                    key={row.id}
                    onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                    className="cursor-pointer border-t border-border hover:bg-panel-2"
                  >
                    <td className="whitespace-nowrap px-md py-2 text-xs text-muted">
                      {formatDateTime(row.occurredAt, { locale, timeZone })}
                    </td>
                    <td className="px-md py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ACTION_COLOR[row.action]}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-md py-2 font-mono text-xs">
                      {row.entityName} #{row.entityId}
                    </td>
                    <td className="px-md py-2 text-xs">{row.userName ?? '—'}</td>
                    <td className="px-md py-2 text-xs text-dim">{row.origin ?? '—'}</td>
                  </tr>
                );
                if (expanded !== row.id || row.fields.length === 0) return [main];
                const detail = (
                  <tr key={`${row.id}-detail`} className="border-t border-border bg-panel/50">
                    <td colSpan={5} className="px-md py-sm">
                      <table className="w-full text-xs">
                        <thead className="text-dim">
                          <tr>
                            <th className="text-left">Campo</th>
                            <th className="text-left">De</th>
                            <th className="text-left">Para</th>
                          </tr>
                        </thead>
                        <tbody>
                          {row.fields.map((f, j) => (
                            <tr key={j} className="border-t border-border/50">
                              <td className="py-1 font-mono">{f.fieldName}</td>
                              <td className="py-1 text-muted">{f.oldValue ?? '∅'}</td>
                              <td className="py-1 text-text">{f.newValue ?? '∅'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                );
                return [main, detail];
              })}
            </tbody>
          </table>
        )}
      </div>

      {data && data.items.length > 0 && (
        <div className="flex items-center justify-end gap-sm border-t border-border p-md text-xs">
          <span className="text-muted">Página {page} de {totalPages}</span>
          <Button variant="ghost" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
