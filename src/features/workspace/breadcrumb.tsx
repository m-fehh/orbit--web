'use client';

import { ChevronLeft, ChevronRight, ChevronRight as Sep } from 'lucide-react';
import { useTabStore, currentLocation } from '@/features/workspace/tab-store';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

const SECTION_LABEL: Record<string, string> = {
  tickets: 'Tickets',
  ticket: 'Tickets',
  dashboard: 'Dashboard',
  users: 'Usuários',
  knowledge: 'Conhecimento',
  investigations: 'Investigações',
  analytics: 'Analytics',
  admin: 'Administração',
};

/** Breadcrumb + navegação (back/forward) da aba ativa, baseada no histórico. */
export function Breadcrumb() {
  const { tabs, activeId, back, forward } = useTabStore();
  const tab = tabs.find((t) => t.id === activeId);
  if (!tab) return null;

  const loc = currentLocation(tab);
  const canBack = tab.index > 0;
  const canForward = tab.index < tab.history.length - 1;

  return (
    <div className="flex h-10 items-center gap-sm border-b border-border/40 px-md text-sm">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => back()}
          disabled={!canBack}
          className={cn(
            'grid h-7 w-7 place-items-center rounded text-muted hover:bg-panel-2 hover:text-text',
            !canBack && 'cursor-not-allowed opacity-40',
          )}
          aria-label="Voltar"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => forward()}
          disabled={!canForward}
          className={cn(
            'grid h-7 w-7 place-items-center rounded text-muted hover:bg-panel-2 hover:text-text',
            !canForward && 'cursor-not-allowed opacity-40',
          )}
          aria-label="Avançar"
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <span className="h-4 w-px bg-border" aria-hidden />

      <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name={loc.icon} className="h-3.5 w-3.5 text-primary" />
          {SECTION_LABEL[loc.kind] ?? loc.kind}
        </span>
        {loc.kind === 'ticket' && (
          <>
            <Sep className="h-3.5 w-3.5 text-dim" aria-hidden />
            <span className="truncate font-medium text-text">{loc.title}</span>
          </>
        )}
      </nav>
    </div>
  );
}
