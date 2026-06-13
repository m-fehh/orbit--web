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

/** Abre a janela modal de criação de ticket. */
export function openNewTicketWindow() {
  useWindowStore.getState().open({
    id: NEW_TICKET_WINDOW,
    title: 'Novo ticket',
    icon: <FilePlus2 className="h-4 w-4" />,
    modal: true,
    width: 580,
    height: 600,
    content: <NewTicketForm windowId={NEW_TICKET_WINDOW} />,
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
