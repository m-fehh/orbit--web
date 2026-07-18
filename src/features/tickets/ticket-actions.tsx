'use client';

import { Ticket, FilePlus2 } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import { useTabStore } from '@/features/workspace/tab-store';
import { NewTicketForm } from '@/features/tickets/new-ticket-form';

const NEW_TICKET_WINDOW = 'new-ticket';

/** Abre (ou foca) a aba de detalhe de um ticket. */
export function openTicketTab(ticket: { id: number; number: string; title?: string }) {
  useTabStore.getState().openTab({
    kind: 'ticket',
    params: { id: ticket.id },
    title: `#${ticket.number}`,
    icon: 'ticket',
  });
}

/** Abre a janela modal de criação de ticket (opcionalmente pré-preenchida). */
export function openNewTicketWindow(initial?: { title?: string; description?: string }) {
  useWindowStore.getState().open({
    id: NEW_TICKET_WINDOW,
    title: 'Novo ticket',
    icon: <FilePlus2 className="h-4 w-4" />,
    modal: true,
    width: 680,
    height: 700,
    content: <NewTicketForm windowId={NEW_TICKET_WINDOW} initialTitle={initial?.title} initialDescription={initial?.description} />,
  });
}

/** Abre/foca a central de tickets. */
export function openTicketsCentral() {
  useTabStore.getState().openTab({
    kind: 'tickets',
    params: {},
    title: 'Central de Tickets',
    icon: 'tickets',
  });
}

export const TicketIcon = Ticket;
