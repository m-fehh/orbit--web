'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutGrid, Plus } from 'lucide-react';
import { useTabStore, currentLocation } from '@/features/workspace/tab-store';
import { openNewTicketWindow, openTicketsCentral } from '@/features/tickets/ticket-actions';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { TabBar } from './tab-bar';
import { Breadcrumb } from './breadcrumb';
import { renderView } from './view-registry';

/** Área de trabalho com abas: TabBar + breadcrumb + view ativa. */
export function Workspace() {
  const t = useTranslations('workspace');
  const hydrate = useTabStore((s) => s.hydrate);
  const tabs = useTabStore((s) => s.tabs);
  const activeId = useTabStore((s) => s.activeId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const active = tabs.find((tb) => tb.id === activeId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <TabBar />
      {active ? (
        <>
          <Breadcrumb />
          <div className="min-h-0 flex-1 overflow-hidden">{renderView(currentLocation(active))}</div>
        </>
      ) : (
        <div className="grid flex-1 place-items-center">
          <div className="flex flex-col items-center gap-md text-center animate-rise">
            <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary glow-ring animate-float">
              <LayoutGrid className="h-7 w-7" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('emptyTitle')}</h2>
              <p className="text-sm text-muted">{t('emptySubtitle')}</p>
            </div>
            <div className="flex gap-sm">
              <Can permission="ticket.view">
                <Button variant="secondary" onClick={openTicketsCentral}>
                  <LayoutGrid className="h-4 w-4" /> {t('openTickets')}
                </Button>
              </Can>
              <Can permission="ticket.create">
                <Button onClick={openNewTicketWindow}>
                  <Plus className="h-4 w-4" /> {t('newTicket')}
                </Button>
              </Can>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
