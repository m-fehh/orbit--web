'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  LayoutGrid,
  BookOpen,
  BarChart3,
  Users as UsersIcon,
  ShieldCheck,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  X,
  Repeat,
  Tags,
  type LucideIcon,
} from 'lucide-react';
import { useUiStore } from '@/features/shell/ui-store';
import { useTabStore, currentLocation, type TabLocation } from '@/features/workspace/tab-store';
import { usePermissions } from '@/features/auth/use-permissions';
import { cn } from '@/shared/lib/utils';

type NavLabel = 'dashboard' | 'tickets' | 'knowledge' | 'analytics' | 'users' | 'admin' | 'audit' | 'iterations' | 'tags';

interface NavItem {
  loc: TabLocation;
  labelKey: NavLabel;
  icon: LucideIcon;
  perm?: string[];
}

interface NavSection {
  titleKey: 'secOperation' | 'secInsights' | 'secAdmin';
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: 'secOperation',
    items: [
      { loc: { kind: 'dashboard', params: {}, title: 'Dashboard', icon: 'dashboard' }, labelKey: 'dashboard', icon: LayoutDashboard, perm: ['analytics.dashboard'] },
      { loc: { kind: 'tickets', params: {}, title: 'Central de Tickets', icon: 'tickets' }, labelKey: 'tickets', icon: LayoutGrid, perm: ['ticket.view'] },

      { loc: { kind: 'knowledge', params: {}, title: 'Conhecimento', icon: 'knowledge' }, labelKey: 'knowledge', icon: BookOpen, perm: ['knowledge.view'] },
      { loc: { kind: 'iterations', params: {}, title: 'Iterações', icon: 'tickets' }, labelKey: 'iterations', icon: Repeat, perm: ['ticket.view'] },
      { loc: { kind: 'tags', params: {}, title: 'Tags', icon: 'admin' }, labelKey: 'tags', icon: Tags, perm: ['ticket.view'] },
    ],
  },
  {
    titleKey: 'secInsights',
    items: [
      { loc: { kind: 'analytics', params: {}, title: 'Analytics', icon: 'analytics' }, labelKey: 'analytics', icon: BarChart3, perm: ['analytics.dashboard', 'analytics.kpis'] },
    ],
  },
  {
    titleKey: 'secAdmin',
    items: [
      { loc: { kind: 'users', params: {}, title: 'Usuários', icon: 'users' }, labelKey: 'users', icon: UsersIcon, perm: ['admin.users.view'] },
      { loc: { kind: 'admin', params: {}, title: 'Perfis', icon: 'admin' }, labelKey: 'admin', icon: ShieldCheck, perm: ['role.view', 'admin.users.view'] },
      { loc: { kind: 'audit', params: {}, title: 'Logs de auditoria', icon: 'audit' }, labelKey: 'audit', icon: ScrollText, perm: ['auditlog.view'] },
    ],
  },
];

/** Sidebar responsiva: fixa no desktop (colapsável) e drawer no mobile. */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const tw = useTranslations('workspace');

  return (
    <>
      {/* Desktop */}
      <nav
        aria-label="Primary"
        className={cn(
          'relative hidden shrink-0 flex-col border-r border-border bg-bg-subtle/40 transition-all md:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={collapsed ? tw('forward') : tw('back')}
          title={collapsed ? tw('forward') : tw('back')}
          className="absolute -right-3 top-4 z-20 grid h-6 w-6 place-items-center rounded-full border border-border bg-panel text-muted shadow-sm transition-colors hover:border-primary hover:text-primary"
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" aria-hidden /> : <ChevronLeft className="h-3.5 w-3.5" aria-hidden />}
        </button>
        <SidebarNav collapsed={collapsed} />
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} aria-hidden />
          <nav
            aria-label="Primary"
            className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-panel shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-md py-sm">
              <span className="font-semibold">Orbit</span>
              <button
                type="button"
                onClick={() => setMobileNav(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-panel-2"
                aria-label={tw('close')}
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileNav(false)} />
          </nav>
        </div>
      )}
    </>
  );
}

function SidebarNav({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const { canAny } = usePermissions();
  const { tabs, activeId, openTab } = useTabStore();
  const activeTab = tabs.find((tb) => tb.id === activeId);
  const activeKind = activeTab ? currentLocation(activeTab).kind : null;

  function open(loc: TabLocation) {
    openTab(loc);
    router.push('/workspace');
    onNavigate?.();
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-md overflow-y-auto p-sm">
      {SECTIONS.map((section) => {
        const items = section.items.filter((it) => !it.perm || canAny(it.perm));
        if (items.length === 0) return null;
        return (
          <div key={section.titleKey} className="flex flex-col gap-0.5">
            {!collapsed && (
              <p className="px-md pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-dim">
                {t(section.titleKey)}
              </p>
            )}
            {items.map(({ loc, labelKey, icon: Icon }) => {
              const active = activeKind === loc.kind;
              return (
                <button
                  key={loc.kind}
                  type="button"
                  onClick={() => open(loc)}
                  aria-current={active ? 'page' : undefined}
                  title={collapsed ? t(labelKey) : undefined}
                  className={cn(
                    'flex items-center gap-sm rounded-md px-md py-2 text-sm transition-colors',
                    active ? 'bg-primary-soft font-medium text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
                    collapsed && 'justify-center px-0',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>{t(labelKey)}</span>}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
