'use client';

import { useMemo } from 'react';
import { ChevronRight as Sep, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTabStore, currentLocation, type ViewKind, type TabLocation } from '@/features/workspace/tab-store';
import { useTourStore } from '@/features/tour/tour-store';
import { tourFor } from '@/features/tour/tours';
import { Icon } from './icons';
import { cn } from '@/shared/lib/utils';

/** Mapeia o tipo de view para a chave de tradução do menu (nav.*). */
const SECTION_NAV_KEY: Record<ViewKind, string> = {
  tickets: 'tickets',
  ticket: 'tickets',
  dashboard: 'dashboard',
  users: 'users',
  investigations: 'investigations',
  analytics: 'analytics',
  admin: 'admin',
  audit: 'audit',
  sla: 'sla',
  intelligence: 'intelligence',
  playbooks: 'playbooks',
  reliability: 'reliability',
  copilot: 'copilot',
  problems: 'problems',
  performance: 'performance',
  iterations: 'iterations',
  tags: 'tags',
  system: 'system',
  webhooks: 'webhooks',
  knowledge: 'knowledge',
  settings: 'settings',
};

const SECTION_META: Record<ViewKind, { indexKind: ViewKind; icon: TabLocation['icon'] }> = {
  tickets: { indexKind: 'tickets', icon: 'tickets' },
  ticket: { indexKind: 'tickets', icon: 'tickets' },
  dashboard: { indexKind: 'dashboard', icon: 'dashboard' },
  users: { indexKind: 'users', icon: 'users' },
  investigations: { indexKind: 'investigations', icon: 'search' },
  analytics: { indexKind: 'analytics', icon: 'analytics' },
  admin: { indexKind: 'admin', icon: 'admin' },
  audit: { indexKind: 'audit', icon: 'audit' },
  sla: { indexKind: 'sla', icon: 'admin' },
  intelligence: { indexKind: 'intelligence', icon: 'analytics' },
  playbooks: { indexKind: 'playbooks', icon: 'analytics' },
  reliability: { indexKind: 'reliability', icon: 'analytics' },
  copilot: { indexKind: 'copilot', icon: 'analytics' },
  problems: { indexKind: 'problems', icon: 'analytics' },
  performance: { indexKind: 'performance', icon: 'analytics' },
  iterations: { indexKind: 'iterations', icon: 'tickets' },
  tags: { indexKind: 'tags', icon: 'admin' },
  system: { indexKind: 'system', icon: 'admin' },
  webhooks: { indexKind: 'webhooks', icon: 'admin' },
  knowledge: { indexKind: 'knowledge', icon: 'knowledge' },
  settings: { indexKind: 'settings', icon: 'admin' },
};

/** Breadcrumb + navegação (back/forward) da aba ativa, baseada no histórico. */
export function Breadcrumb() {
  const t = useTranslations('nav');
  const tTour = useTranslations('tour');
  const { tabs, activeId, openTab } = useTabStore();
  const startTour = useTourStore((s) => s.start);
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
  // Uma aba persistida (localStorage) pode ter um kind removido em versões
  // anteriores — nesse caso o índice de seção não tem entrada. Trata como
  // seção própria (sem link de volta) em vez de quebrar a tela.
  const section = sectionIndex[loc.kind];
  const sectionIsDistinct = !!section && loc.kind !== section.kind;

  return (
    <div className="flex h-10 items-center gap-sm border-b border-border/40 px-md text-sm">
      <nav aria-label="breadcrumb" className="flex min-w-0 items-center gap-1 text-muted">
        <button
          type="button"
          onClick={() => section && openTab(section)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded px-1 py-0.5',
            sectionIsDistinct ? 'hover:bg-panel-2 hover:text-text' : 'cursor-default',
          )}
          disabled={!sectionIsDistinct}
        >
          <Icon name={loc.icon} className="h-3.5 w-3.5 text-primary" />
          {SECTION_NAV_KEY[loc.kind] ? t(SECTION_NAV_KEY[loc.kind] as 'tickets') : loc.title}
        </button>
        {sectionIsDistinct && (
          <>
            <Sep className="h-3.5 w-3.5 text-dim" aria-hidden />
            <span className="truncate font-medium text-text">{loc.title}</span>
          </>
        )}
      </nav>

      <button
        type="button"
        onClick={() => startTour(tourFor(loc.kind))}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted transition-colors hover:border-primary/40 hover:text-primary"
        title={tTour('screenTour')}
      >
        <HelpCircle className="h-3.5 w-3.5" /> {tTour('screenTour')}
      </button>
    </div>
  );
}
