'use client';

import { useMemo } from 'react';
import { ChevronRight as Sep } from 'lucide-react';
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
  'knowledge-article': 'knowledge',
  investigations: 'investigations',
  analytics: 'analytics',
  admin: 'admin',
  audit: 'audit',
  intelligence: 'intelligence',
  iterations: 'iterations',
  tags: 'tags',
};

const SECTION_META: Record<ViewKind, { indexKind: ViewKind; icon: TabLocation['icon'] }> = {
  tickets: { indexKind: 'tickets', icon: 'tickets' },
  ticket: { indexKind: 'tickets', icon: 'tickets' },
  dashboard: { indexKind: 'dashboard', icon: 'dashboard' },
  users: { indexKind: 'users', icon: 'users' },
  knowledge: { indexKind: 'knowledge', icon: 'knowledge' },
  'knowledge-article': { indexKind: 'knowledge', icon: 'knowledge' },
  investigations: { indexKind: 'investigations', icon: 'search' },
  analytics: { indexKind: 'analytics', icon: 'analytics' },
  admin: { indexKind: 'admin', icon: 'admin' },
  audit: { indexKind: 'audit', icon: 'audit' },
  intelligence: { indexKind: 'intelligence', icon: 'analytics' },
  iterations: { indexKind: 'iterations', icon: 'tickets' },
  tags: { indexKind: 'tags', icon: 'admin' },
};

/** Breadcrumb + navegação (back/forward) da aba ativa, baseada no histórico. */
export function Breadcrumb() {
  const t = useTranslations('nav');
  const { tabs, activeId, openTab } = useTabStore();
  const tab = tabs.find((tb) => tb.id === activeId);

  const sectionIndex = useMemo<Record<ViewKind, TabLocation>>(() => {
    const entries = Object.entries(SECTION_META) as [ViewKind, typeof SECTION_META[ViewKind]][];
    return Object.fromEntries(
      entries.map(([kind, meta]) => [
        kind,
        { kind: meta.indexKind, params: {}, title: t(SECTION_NAV_KEY[kind] as 'tickets'), icon: meta.icon },
      ]),
    ) as Record<ViewKind, TabLocation>;
  }, [t]);

  if (!tab) return null;

  const loc = currentLocation(tab);
  const sectionIsDistinct = loc.kind !== sectionIndex[loc.kind].kind;

  return (
    <div className="flex h-10 items-center gap-sm border-b border-border/40 px-md text-sm">
      <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-muted">
        <button
          type="button"
          onClick={() => openTab(sectionIndex[loc.kind])}
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
