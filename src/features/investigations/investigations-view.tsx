'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { FlaskConical, RefreshCw } from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/button';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { StatusBadge, PriorityBadge } from '@/features/tickets/badges';
import { openTicketTab } from '@/features/tickets/ticket-actions';

/**
 * Investigações — listagem agregada por ticket. A API mantém investigações
 * sempre vinculadas a um ticket (não há endpoint "global"), então usamos a
 * grid de tickets como ponto de partida e mostramos quantos investigações
 * abertas/encerradas cada um tem.
 */
export function InvestigationsView() {
  const t = useTranslations('investigation');
  const tTicket = useTranslations('ticket');
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['investigations', 'tickets-with-inv'],
    queryFn: () => ticketsApi.list(1, 100),
  });

  const items = useMemo(
    () => (data?.items ?? []).filter((tk) => tk.investigationsCount > 0),
    [data],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">{items.length} {tTicket('loading') ? '' : ''}{items.length === 1 ? 'ticket' : 'tickets'}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar" className="ml-auto">
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState title="Erro" onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : items.length === 0 ? (
          <EmptyState icon={FlaskConical} message={t('empty')} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">#</th>
                <th className="px-md py-2 font-semibold">Ticket</th>
                <th className="px-md py-2 font-semibold">Status</th>
                <th className="px-md py-2 font-semibold">{tTicket('priority' as 'requester')}</th>
                <th className="px-md py-2 text-center font-semibold">{t('title')}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((tk) => (
                <tr
                  key={tk.id}
                  onClick={() => openTicketTab(tk)}
                  className="cursor-pointer border-t border-border/40 transition-colors hover:bg-primary-soft/40"
                >
                  <td className="px-md py-2.5 font-mono text-xs font-semibold text-primary">{tk.number}</td>
                  <td className="max-w-[420px] truncate px-md py-2.5">{tk.title}</td>
                  <td className="px-md py-2.5"><StatusBadge status={tk.status} /></td>
                  <td className="px-md py-2.5"><PriorityBadge priority={tk.priority} /></td>
                  <td className="px-md py-2.5 text-center">
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                      <FlaskConical className="h-3 w-3" /> {tk.investigationsCount}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
