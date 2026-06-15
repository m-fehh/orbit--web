'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import { Plus, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { ticketsApi } from '@/shared/api/endpoints';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { openNewTicketWindow, openTicketTab } from '@/features/tickets/ticket-actions';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { PriorityBadge, StatusBadge } from './badges';

/** Central de Tickets: lista paginada com busca e ações. */
export function TicketsCentral() {
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState('');
  const pageSize = 20;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tickets', 'list', page],
    queryFn: () => ticketsApi.list(page, pageSize),
  });

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter(
      (t) => t.title.toLowerCase().includes(q) || t.number.toLowerCase().includes(q),
    );
  }, [data, term]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-sm border-b border-border/50 p-md">
        <div>
          <h1 className="text-lg font-bold">Central de Tickets</h1>
          <p className="text-xs text-muted">{data ? `${data.totalCount} tickets` : '—'}</p>
        </div>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filtrar por número ou título…"
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar">
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
        </Button>
        <Can permission="ticket.create">
          <Button onClick={openNewTicketWindow}>
            <Plus className="h-4 w-4" aria-hidden /> Novo ticket
          </Button>
        </Can>
      </div>

      {/* Conteúdo */}
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState label="Carregando tickets…" />
        ) : isError ? (
          <ErrorState title="Erro ao carregar" body="Verifique a API e tente de novo." onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : items.length === 0 ? (
          <EmptyState
            message="Nenhum ticket encontrado."
            cta={
              <Can permission="ticket.create">
                <Button onClick={openNewTicketWindow}>
                  <Plus className="h-4 w-4" /> Criar o primeiro
                </Button>
              </Can>
            }
          />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">Número</th>
                <th className="px-md py-2 font-semibold">Título</th>
                <th className="px-md py-2 font-semibold">Prioridade</th>
                <th className="px-md py-2 font-semibold">Status</th>
                <th className="px-md py-2 text-center font-semibold">💬</th>
                <th className="px-md py-2 font-semibold">Aberto</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => openTicketTab(t)}
                  className="cursor-pointer border-t border-border/40 transition-colors hover:bg-primary-soft/40"
                >
                  <td className="px-md py-2.5 font-mono text-xs font-semibold text-primary">{t.number}</td>
                  <td className="max-w-[420px] truncate px-md py-2.5">{t.title}</td>
                  <td className="px-md py-2.5"><PriorityBadge priority={t.priority} /></td>
                  <td className="px-md py-2.5"><StatusBadge status={t.status} /></td>
                  <td className="px-md py-2.5 text-center text-muted">{t.commentsCount}</td>
                  <td className="px-md py-2.5 text-muted">{formatDateTime(t.openedAt, { locale, timeZone })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-sm border-t border-border/50 px-md py-2 text-sm">
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
