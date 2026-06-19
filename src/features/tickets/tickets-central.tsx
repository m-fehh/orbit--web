'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Plus, Search, ChevronLeft, ChevronRight, RefreshCw, Filter, X } from 'lucide-react';
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
import { TicketStatus, Priority } from '@/shared/api/types';

type SortBy = 'opened' | 'updated' | 'priority' | 'status';

/** Central de Tickets: lista paginada com filtros, busca e ações. */
export function TicketsCentral() {
  const locale = useLocale() as Locale;
  const t = useTranslations('ticket');
  const tStatus = useTranslations('ticketStatus');
  const tPriority = useTranslations('priority');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('opened');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const pageSize = 20;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['tickets', 'list', page, sortBy, statusFilter, priorityFilter],
    queryFn: () => ticketsApi.list(page, pageSize),
  });

  const items = useMemo(() => {
    let list = data?.items ?? [];

    if (statusFilter.length > 0) {
      list = list.filter((t) => statusFilter.includes(t.status));
    }

    if (priorityFilter.length > 0) {
      list = list.filter((t) => priorityFilter.includes(t.priority));
    }

    if (term.trim()) {
      const q = term.toLowerCase();
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.number.toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => {
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          return (priorityOrder[a.priority as keyof typeof priorityOrder] ?? 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] ?? 99);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'updated':
          return new Date(b.lastUpdateUTC).getTime() - new Date(a.lastUpdateUTC).getTime();
        case 'opened':
        default:
          return new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime();
      }
    });
  }, [data, term, statusFilter, priorityFilter, sortBy]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;
  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border/50 p-md">
        <div className="flex flex-wrap items-center gap-sm mb-sm">
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
          <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label="Atualizar" disabled={isFetching}>
            <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
          </Button>
          <Can permission="ticket.create">
            <Button onClick={openNewTicketWindow}>
              <Plus className="h-4 w-4" aria-hidden /> Novo ticket
            </Button>
          </Can>
        </div>

        {/* Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Filter className="h-3.5 w-3.5 text-dim" aria-hidden />

          {/* Status filter */}
          <div className="flex gap-1">
            {Object.entries(TicketStatus).map(([k, v]) => (
              <button
                key={v}
                onClick={() => setStatusFilter((prev) => prev.includes(k) ? prev.filter((s) => s !== k) : [...prev, k])}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  statusFilter.includes(k)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                {tStatus(k as any)}
              </button>
            ))}
          </div>

          {/* Priority filter */}
          <div className="flex gap-1 ml-2 pl-2 border-l border-border/40">
            {Object.entries(Priority).map(([k, v]) => (
              <button
                key={v}
                onClick={() => setPriorityFilter((prev) => prev.includes(k) ? prev.filter((p) => p !== k) : [...prev, k])}
                className={`rounded-full border px-2 py-0.5 transition-colors ${
                  priorityFilter.includes(k)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted hover:text-text'
                }`}
              >
                {tPriority(k as any)}
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <div className="ml-auto flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="rounded-md border border-border bg-bg-subtle px-2 py-0.5 text-xs text-text outline-none hover:border-border-strong focus:border-primary"
            >
              <option value="opened">Recém abertos</option>
              <option value="updated">Recém atualizados</option>
              <option value="priority">Por prioridade</option>
              <option value="status">Por status</option>
            </select>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={() => { setStatusFilter([]); setPriorityFilter([]); }}
              className="text-muted hover:text-danger transition-colors"
              aria-label="Limpar filtros"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          )}
        </div>
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
                <th className="px-md py-2 font-semibold cursor-pointer hover:text-text" onClick={() => setSortBy('opened')}>
                  Número {sortBy === 'opened' ? '↓' : ''}
                </th>
                <th className="px-md py-2 font-semibold">Título</th>
                <th className="px-md py-2 font-semibold cursor-pointer hover:text-text" onClick={() => setSortBy('priority')}>
                  Prioridade {sortBy === 'priority' ? '↓' : ''}
                </th>
                <th className="px-md py-2 font-semibold cursor-pointer hover:text-text" onClick={() => setSortBy('status')}>
                  Status {sortBy === 'status' ? '↓' : ''}
                </th>
                <th className="px-md py-2 text-center font-semibold">💬</th>
                <th className="px-md py-2 font-semibold cursor-pointer hover:text-text" onClick={() => setSortBy('updated')}>
                  Atualizado {sortBy === 'updated' ? '↓' : ''}
                </th>
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
                  <td className="px-md py-2.5 text-muted text-xs">{formatDateTime(t.lastUpdateUTC, { locale, timeZone })}</td>
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
