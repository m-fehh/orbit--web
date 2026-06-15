'use client';

import type { TabLocation } from '@/features/workspace/tab-store';
import { TicketsCentral } from '@/features/tickets/tickets-central';
import { TicketDetail } from '@/features/tickets/ticket-detail';
import { UsersView } from '@/features/admin/users-view';
import { ProfileGroupsView } from '@/features/admin/profile-groups-view';
import { DashboardView } from '@/features/dashboard/dashboard-view';
import { EmptyState } from '@/shared/ui/states';
import { ICONS } from './icons';

/** Resolve a localização de uma aba para o componente de view correspondente. */
export function renderView(loc: TabLocation) {
  switch (loc.kind) {
    case 'tickets':
      return <TicketsCentral />;
    case 'ticket':
      return <TicketDetail id={Number(loc.params.id)} />;
    case 'dashboard':
      return <DashboardView />;
    case 'users':
      return <UsersView />;
    case 'admin':
      return <ProfileGroupsView />;
    default:
      return (
        <div className="grid h-full place-items-center">
          <EmptyState
            icon={ICONS[loc.icon]}
            message={`A seção "${loc.title}" entra em breve.`}
          />
        </div>
      );
  }
}
