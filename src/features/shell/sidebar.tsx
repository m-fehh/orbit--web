'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  LayoutGrid,
  Search as SearchIcon,
  BookOpen,
  BarChart3,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { useUiStore } from '@/features/shell/ui-store';
import { useTabStore, currentLocation, type TabLocation } from '@/features/workspace/tab-store';
import { cn } from '@/shared/lib/utils';

interface NavItem {
  loc: TabLocation;
  labelKey: 'dashboard' | 'tickets' | 'investigations' | 'knowledge' | 'analytics' | 'admin';
  icon: LucideIcon;
}

const ITEMS: NavItem[] = [
  { loc: { kind: 'dashboard', params: {}, title: 'Dashboard', icon: 'dashboard' }, labelKey: 'dashboard', icon: LayoutDashboard },
  { loc: { kind: 'tickets', params: {}, title: 'Central de Tickets', icon: 'tickets' }, labelKey: 'tickets', icon: LayoutGrid },
  { loc: { kind: 'investigations', params: {}, title: 'Investigações', icon: 'search' }, labelKey: 'investigations', icon: SearchIcon },
  { loc: { kind: 'knowledge', params: {}, title: 'Conhecimento', icon: 'knowledge' }, labelKey: 'knowledge', icon: BookOpen },
  { loc: { kind: 'analytics', params: {}, title: 'Analytics', icon: 'analytics' }, labelKey: 'analytics', icon: BarChart3 },
  { loc: { kind: 'admin', params: {}, title: 'Administração', icon: 'admin' }, labelKey: 'admin', icon: ShieldCheck },
];

/** Sidebar: cada item abre/foca uma aba no workspace. */
export function Sidebar() {
  const t = useTranslations('nav');
  const router = useRouter();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const { tabs, activeId, openTab } = useTabStore();
  const activeKind = tabs.find((t) => t.id === activeId);
  const activeLocKind = activeKind ? currentLocation(activeKind).kind : null;

  function open(loc: TabLocation) {
    openTab(loc);
    router.push('/workspace');
  }

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'hidden shrink-0 flex-col gap-1 border-r border-border/60 bg-bg-subtle/40 p-sm transition-all md:flex',
        collapsed ? 'w-16' : 'w-56',
      )}
    >
      {ITEMS.map(({ loc, labelKey, icon: Icon }) => {
        const active = activeLocKind === loc.kind;
        return (
          <button
            key={loc.kind}
            type="button"
            onClick={() => open(loc)}
            aria-current={active ? 'page' : undefined}
            title={collapsed ? t(labelKey) : undefined}
            className={cn(
              'flex items-center gap-sm rounded-md px-md py-sm text-sm transition-colors',
              active ? 'bg-primary-soft text-primary glow-ring' : 'text-muted hover:bg-panel-2 hover:text-text',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            {!collapsed && <span>{t(labelKey)}</span>}
          </button>
        );
      })}
    </nav>
  );
}
