'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FlaskConical, RefreshCw, Search, Lightbulb, FileText, Target } from 'lucide-react';
import { investigationsApi } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { openTicketTab } from '@/features/tickets/ticket-actions';
import { useLocale } from 'next-intl';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { cn } from '@/shared/lib/utils';

export function InvestigationsView() {
  const t = useTranslations('investigation');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const pageSize = 20;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['investigations', 'list', page, status],
    queryFn: () => investigationsApi.list({ page, pageSize, ...(status ? { status } : {}) }),
  });

  const items = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">
            {data ? `${data.totalCount} investigações` : '—'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="h-8 rounded-md border border-border bg-bg-subtle px-2 text-xs text-text outline-none focus:border-primary"
          >
            <option value="">Todos os status</option>
            <option value="open">Em andamento</option>
            <option value="finished">Concluída</option>
          </select>
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar">
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState title="Erro ao carregar" onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : items.length === 0 ? (
          <EmptyState icon={FlaskConical} message={t('empty')} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">ID</th>
                <th className="px-md py-2 font-semibold">Ticket</th>
                <th className="px-md py-2 font-semibold">Resumo</th>
                <th className="px-md py-2 font-semibold">Status</th>
                <th className="px-md py-2 text-center font-semibold">
                  <Lightbulb className="mx-auto h-3.5 w-3.5" />
                </th>
                <th className="px-md py-2 text-center font-semibold">
                  <FileText className="mx-auto h-3.5 w-3.5" />
                </th>
                <th className="px-md py-2 font-semibold">Causa raiz</th>
                <th className="px-md py-2 font-semibold">Início</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr
                  key={inv.id}
                  onClick={() => openTicketTab({ id: inv.ticketId, number: `#${inv.ticketId}`, title: inv.summary ?? 'Investigação' } as any)}
                  className="cursor-pointer border-t border-border/40 transition-colors hover:bg-primary-soft/40"
                >
                  <td className="px-md py-2.5 font-mono text-xs font-semibold text-primary">#{inv.id}</td>
                  <td className="px-md py-2.5 font-mono text-xs text-muted">#{inv.ticketId}</td>
                  <td className="max-w-[320px] truncate px-md py-2.5">{inv.summary ?? '—'}</td>
                  <td className="px-md py-2.5">
                    <span className={cn(
                      'inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase',
                      inv.finishedAt ? 'bg-success/15 text-success' : 'bg-info/15 text-info',
                    )}>
                      {inv.finishedAt ? 'Concluída' : 'Em andamento'}
                    </span>
                  </td>
                  <td className="px-md py-2.5 text-center text-xs text-muted">{inv.hypotheses?.length ?? 0}</td>
                  <td className="px-md py-2.5 text-center text-xs text-muted">{inv.evidences?.length ?? 0}</td>
                  <td className="px-md py-2.5 text-xs">
                    {inv.rootCause ? (
                      <span className="inline-flex items-center gap-1 text-success">
                        <Target className="h-3 w-3" /> {inv.rootCause.title}
                      </span>
                    ) : (
                      <span className="text-dim">—</span>
                    )}
                  </td>
                  <td className="px-md py-2.5 text-xs text-muted">
                    {inv.startedAt ? formatDateTime(inv.startedAt, { locale, timeZone }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-sm border-t border-border px-md py-2 text-sm">
          <span className="text-muted">Página {page} de {totalPages}</span>
          <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Anterior">
            ←
          </Button>
          <Button variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Próxima">
            →
          </Button>
        </div>
      )}
    </div>
  );
}
