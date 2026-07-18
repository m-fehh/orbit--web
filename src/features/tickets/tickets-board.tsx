'use client';

import { useState, type DragEvent } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type TicketResponse, type TicketStatusName, type TicketStatusValue } from '@/shared/api/types';
import { PriorityBadge } from './badges';
import { cn } from '@/shared/lib/utils';

interface StatusOption { value: number; name: string; label: string }

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
                'flex w-72 shrink-0 flex-col rounded-xl border bg-bg-subtle/40 transition-colors',
                isOver ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="text-sm font-semibold text-text">{col.label}</span>
                <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-panel-2 px-1.5 text-[11px] font-medium text-dim">{cards.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                {cards.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-dim">—</p>
                ) : (
                  cards.map((tk) => (
                    <button
                      key={tk.id}
                      type="button"
                      draggable
                      onDragStart={() => setDragId(tk.id)}
                      onDragEnd={() => { setDragId(null); setOverStatus(null); }}
                      onClick={() => onOpen(tk)}
                      className={cn(
                        'card-surface flex cursor-grab flex-col gap-2 rounded-lg border border-border p-2.5 text-left transition-shadow hover:shadow-md active:cursor-grabbing',
                        dragId === tk.id && 'opacity-50',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-primary">{tk.number}</span>
                        <span className="ml-auto"><PriorityBadge priority={tk.priority} /></span>
                      </div>
                      <p className="line-clamp-2 text-xs text-text">{tk.title}</p>
                      <div className="flex items-center gap-2 text-[10px] text-dim">
                        <span>{tk.assignedUserId ? `#${tk.assignedUserId}` : t('unassigned')}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
