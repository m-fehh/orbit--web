'use client';

import { useMemo, useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketsApi, usersApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type TicketResponse, type TicketStatusName, type TicketStatusValue } from '@/shared/api/types';
import { PriorityBadge } from './badges';
import { cn } from '@/shared/lib/utils';

interface StatusOption { value: number; name: string; label: string }

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';

/** Cor de destaque da coluna por família de status (visual mais rico que cinza). */
function columnAccent(name: string): string {
  if (name === 'New' || name === 'Assigned') return 'border-t-primary';
  if (name === 'InProgress') return 'border-t-warning';
  if (name === 'PendingCustomer' || name === 'PendingInternal') return 'border-t-info';
  if (name === 'Resolved' || name === 'Validated' || name === 'Closed') return 'border-t-success';
  return 'border-t-border-strong';
}

/**
 * Visão Kanban dos tickets: uma coluna por status. Arrastar um cartão para outra
 * coluna muda o status via API (drag-and-drop nativo, sem dependências).
 */
export function TicketBoard({ tickets, statusOptions, onOpen }: {
  tickets: TicketResponse[];
  statusOptions: StatusOption[];
  onOpen: (t: TicketResponse) => void;
}) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const [dragId, setDragId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<string | null>(null);

  // Resolve nome do responsável (em vez de exibir o id cru).
  const users = useQuery({ queryKey: ['users', 'options', 200], queryFn: () => usersApi.list(1, 200) });
  const userName = useMemo(() => {
    const map = new Map((users.data?.items ?? []).map((u) => [u.id, u.name] as const));
    return (id: number | null) => (id ? map.get(id) ?? null : null);
  }, [users.data]);

  const changeStatus = useMutation({
    mutationFn: (v: { id: number; status: TicketStatusValue }) => ticketsApi.changeStatus(v.id, v.status),
    onSuccess: () => { toast.success(t('statusUpdated')); qc.invalidateQueries({ queryKey: ['tickets'] }); },
    onError: (e) => toast.error(apiErrorMessage(e, t('statusError'))),
  });

  const drop = (col: StatusOption) => {
    const id = dragId;
    setDragId(null);
    setOverStatus(null);
    if (id == null) return;
    const tk = tickets.find((x) => x.id === id);
    if (tk && tk.status !== col.name) changeStatus.mutate({ id, status: col.value as TicketStatusValue });
  };

  const onDragOver = (e: DragEvent, name: string) => { e.preventDefault(); if (overStatus !== name) setOverStatus(name); };

  return (
    <div className="flex-1 min-h-0 overflow-x-auto">
      <div className="flex h-full min-w-max gap-3 pb-2">
        {statusOptions.map((col) => {
          const cards = tickets.filter((x) => x.status === (col.name as TicketStatusName));
          const isOver = overStatus === col.name;
          return (
            <div
              key={col.value}
              onDragOver={(e) => onDragOver(e, col.name)}
              onDragLeave={() => setOverStatus((s) => (s === col.name ? null : s))}
              onDrop={() => drop(col)}
              className={cn(
                'flex w-72 shrink-0 flex-col rounded-xl border border-t-2 bg-bg-subtle/40 transition-colors',
                columnAccent(col.name),
                isOver ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm font-semibold text-text">{col.label}</span>
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-panel-2 px-1.5 text-[11px] font-medium text-dim">{cards.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                {cards.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border/60 px-2 py-6 text-center text-[11px] text-dim">—</p>
                ) : (
                  cards.map((tk) => {
                    const who = userName(tk.assignedUserId);
                    return (
                      <button
                        key={tk.id}
                        type="button"
                        draggable
                        onDragStart={() => setDragId(tk.id)}
                        onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                        onClick={() => onOpen(tk)}
                        className={cn(
                          'group flex cursor-grab flex-col gap-2 rounded-lg border border-border bg-panel p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow-md active:cursor-grabbing',
                          dragId === tk.id && 'opacity-50 ring-2 ring-primary',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-primary">{tk.number}</span>
                          <span className="ml-auto"><PriorityBadge priority={tk.priority} /></span>
                        </div>
                        <p className="line-clamp-2 text-sm text-text">{tk.title}</p>
                        <div className="flex items-center gap-1.5 pt-0.5">
                          {who ? (
                            <>
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">{initials(who)}</span>
                              <span className="truncate text-[11px] text-muted">{who}</span>
                            </>
                          ) : (
                            <span className="text-[11px] italic text-dim">{t('unassigned')}</span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
