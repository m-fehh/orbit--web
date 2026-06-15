'use client';

import { ChevronLeft, ChevronRight, ChevronRight as Sep } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTabStore, currentLocation, type ViewKind, type TabLocation } from '@/features/workspace/tab-store';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

/** Mapeia o tipo de view para a chave de tradução do menu (nav.*). */
const SECTION_NAV_KEY: Record<ViewKind, string> = {
  tickets: 'tickets',
  ticket: 'tickets',
  dashboard: 'dashboard',
  users: 'users',
  knowledge: 'knowledge',
  investigations: 'investigations',
  analytics: 'analytics',
  admin: 'admin',
};

/** Localização "índice" da seção a que a view pertence (para o breadcrumb navegável). */
const SECTION_INDEX: Record<ViewKind, TabLocation> = {
  tickets: { kind: 'tickets', params: {}, title: 'Central de Tickets', icon: 'tickets' },
  ticket: { kind: 'tickets', params: {}, title: 'Central de Tickets', icon: 'tickets' },
  dashboard: { kind: 'dashboard', params: {}, title: 'Dashboard', icon: 'dashboard' },
  users: { kind: 'users', params: {}, title: 'Usuários', icon: 'users' },
  knowledge: { kind: 'knowledge', params: {}, title: 'Conhecimento', icon: 'knowledge' },
  investigations: { kind: 'investigations', params: {}, title: 'Investigações', icon: 'search' },
  analytics: { kind: 'analytics', params: {}, title: 'Analytics', icon: 'analytics' },
  admin: { kind: 'admin', params: {}, title: 'Perfis', icon: 'admin' },
};

/** Breadcrumb + navegação (back/forward) da aba ativa, baseada no histórico. */
export function Breadcrumb() {
  const t = useTranslations('nav');
  const tw = useTranslations('workspace');
  const { tabs, activeId, back, forward, openTab } = useTabStore();
  const tab = tabs.find((tb) => tb.id === activeId);
  if (!tab) return null;

  const loc = currentLocation(tab);
  const canBack = tab.index > 0;
  const canForward = tab.index < tab.history.length - 1;
  // A seção (ex.: "Tickets") é clicável e abre/foca a aba-índice da seção.
  const sectionIsDistinct = loc.kind !== SECTION_INDEX[loc.kind].kind;

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
          aria-label={tw('back')}
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
          aria-label={tw('forward')}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <span className="h-4 w-px bg-border" aria-hidden />

      <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-muted">
        <button
          type="button"
          onClick={() => openTab(SECTION_INDEX[loc.kind])}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-1 py-0.5',
            sectionIsDistinct ? 'hover:bg-panel-2 hover:text-text' : 'cursor-default',
          )}
          disabled={!sectionIsDistinct}
        >
          <Icon name={loc.icon} className="h-3.5 w-3.5 text-primary" />
          {t(SECTION_NAV_KEY[loc.kind] as 'tickets')}
        </button>
        {sectionIsDistinct && (
          <>
            <Sep className="h-3.5 w-3.5 text-dim" aria-hidden />
            <span className="truncate font-medium text-text">{loc.title}</span>
          </>
        )}
      </nav>
    </div>
  );
}
