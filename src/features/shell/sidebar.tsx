'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Ticket,
  Library,
  BarChart3,
  Users as UsersIcon,
  UserCog,
  History,
  Gauge,
  ChevronDown,
  X,
  Milestone,
  Brain,
  ShieldCheck,
  Sparkles,
  Radar,
  Trophy,
  FileBarChart,
  BookOpen,
  type LucideIcon,
} from 'lucide-react';
import { useUiStore } from '@/features/shell/ui-store';
import { useTabStore, currentLocation, type TabLocation } from '@/features/workspace/tab-store';
import { usePermissions } from '@/features/auth/use-permissions';
import { UserMenu } from '@/features/shell/user-menu';
import { cn } from '@/shared/lib/utils';

type NavLabel = 'dashboard' | 'tickets' | 'analytics' | 'users' | 'admin' | 'audit' | 'iterations' | 'intelligence' | 'playbooks' | 'reliability' | 'copilot' | 'problems' | 'sla' | 'performance' | 'reports' | 'knowledge';

interface NavItem {
  loc: TabLocation;
  labelKey: NavLabel;
  icon: LucideIcon;
  perm?: string[];
}

interface NavSection {
  titleKey: 'secOperation' | 'secIntelligence' | 'secAnalysis' | 'secAdmin';
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: 'secOperation',
    items: [
      { loc: { kind: 'dashboard', params: {}, title: 'Dashboard', icon: 'dashboard' }, labelKey: 'dashboard', icon: LayoutDashboard, perm: ['analytics.dashboard'] },
      { loc: { kind: 'tickets', params: {}, title: 'Central de Tickets', icon: 'tickets' }, labelKey: 'tickets', icon: Ticket, perm: ['ticket.view'] },
      { loc: { kind: 'iterations', params: {}, title: 'Iterações', icon: 'tickets' }, labelKey: 'iterations', icon: Milestone, perm: ['ticket.view'] },
    ],
  },
  {
    titleKey: 'secIntelligence',
    items: [
      { loc: { kind: 'copilot', params: {}, title: 'Copiloto de Conhecimento', icon: 'analytics' }, labelKey: 'copilot', icon: Sparkles, perm: ['intelligence.view'] },
      { loc: { kind: 'problems', params: {}, title: 'Radar de Recorrência', icon: 'analytics' }, labelKey: 'problems', icon: Radar, perm: ['intelligence.view'] },
      { loc: { kind: 'playbooks', params: {}, title: 'Base de Soluções', icon: 'analytics' }, labelKey: 'playbooks', icon: Library, perm: ['intelligence.view'] },
      { loc: { kind: 'knowledge', params: {}, title: 'Base de Conhecimento', icon: 'knowledge' }, labelKey: 'knowledge', icon: BookOpen, perm: ['knowledge.view'] },
      { loc: { kind: 'reliability', params: {}, title: 'Confiabilidade', icon: 'analytics' }, labelKey: 'reliability', icon: ShieldCheck, perm: ['intelligence.view'] },
    ],
  },
  {
    titleKey: 'secAnalysis',
    items: [
      { loc: { kind: 'intelligence', params: {}, title: 'Intelligence', icon: 'analytics' }, labelKey: 'intelligence', icon: Brain, perm: ['intelligence.view'] },
      { loc: { kind: 'analytics', params: {}, title: 'Analytics', icon: 'analytics' }, labelKey: 'analytics', icon: BarChart3, perm: ['analytics.dashboard', 'analytics.kpis'] },
      { loc: { kind: 'performance', params: {}, title: 'Desempenho', icon: 'analytics' }, labelKey: 'performance', icon: Trophy, perm: ['ticket.view'] },
      { loc: { kind: 'reports', params: {}, title: 'Relatórios', icon: 'analytics' }, labelKey: 'reports', icon: FileBarChart, perm: ['analytics.kpis'] },
    ],
  },
  {
    titleKey: 'secAdmin',
    items: [
      { loc: { kind: 'users', params: {}, title: 'Usuários', icon: 'users' }, labelKey: 'users', icon: UsersIcon, perm: ['admin.users.view'] },
      { loc: { kind: 'admin', params: {}, title: 'Perfis', icon: 'admin' }, labelKey: 'admin', icon: UserCog, perm: ['admin.profiles.view', 'admin.roles.view'] },
      { loc: { kind: 'audit', params: {}, title: 'Logs de auditoria', icon: 'audit' }, labelKey: 'audit', icon: History, perm: ['auditlog.view'] },
      { loc: { kind: 'sla', params: {}, title: 'SLA', icon: 'admin' }, labelKey: 'sla', icon: Gauge, perm: ['sla.view', 'sla.manage'] },
    ],
  },
];

/** Sidebar: fixa e sempre expandida no desktop; drawer no mobile. */
export function Sidebar() {
  const mobileOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const tw = useTranslations('workspace');

  return (
    <>
      {/* Desktop */}
      <nav
        data-tour="nav"
        aria-label="Primary"
        className="relative hidden w-60 shrink-0 flex-col border-r border-border bg-bg-subtle/50 md:flex"
      >
        <SidebarNav />
        <div data-tour="user" className="border-t border-border p-2">
          <UserMenu variant="sidebar" />
        </div>
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
            <SidebarNav onNavigate={() => setMobileNav(false)} />
            <div className="border-t border-border p-2">
              <UserMenu variant="sidebar" />
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const { canAny } = usePermissions();
  const { tabs, activeId, openTab } = useTabStore();
  const activeTab = tabs.find((tb) => tb.id === activeId);
  const activeKind = activeTab ? currentLocation(activeTab).kind : null;

  // Grupos visíveis (após filtro de permissão) e qual contém a tela ativa.
  const visibleSections = SECTIONS
    .map((s) => ({ ...s, items: s.items.filter((it) => !it.perm || canAny(it.perm)) }))
    .filter((s) => s.items.length > 0);
  const activeSection = visibleSections.find((s) => s.items.some((it) => it.loc.kind === activeKind));

  // Estado de expansão do accordion. Fechados manualmente ficam em `closed`;
  // o grupo da tela ativa abre sozinho (a menos que fechado explicitamente).
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  function open(loc: TabLocation) {
    openTab(loc);
    router.push('/workspace');
    onNavigate?.();
  }

  function NavButton({ loc, labelKey, Icon }: { loc: TabLocation; labelKey: NavLabel; Icon: LucideIcon }) {
    const active = activeKind === loc.kind;
    return (
      <button
        type="button"
        onClick={() => open(loc)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
          active ? 'bg-primary/10 font-semibold text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
        )}
      >
        {active && (
          <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" aria-hidden />
        )}
        <span
          className={cn(
            'grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-colors',
            active ? 'bg-primary/15 text-primary' : 'text-current group-hover:bg-panel',
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="truncate">{t(labelKey)}</span>
      </button>
    );
  }

  // Grupos colapsáveis (accordion). O grupo ativo abre por padrão.
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-sm">
      {visibleSections.map((section) => {
        const isOpen = !closed.has(section.titleKey);
        const hasActive = section === activeSection;
        return (
          <div key={section.titleKey} className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(section.titleKey)}
              aria-expanded={isOpen}
              className="flex items-center gap-1.5 rounded-md px-md pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-dim transition-colors hover:text-text"
            >
              <ChevronDown className={cn('h-3 w-3 shrink-0 transition-transform', isOpen ? '' : '-rotate-90')} aria-hidden />
              <span className="flex-1 text-left">{t(section.titleKey)}</span>
              {!isOpen && hasActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
            </button>
            {isOpen && section.items.map(({ loc, labelKey, icon }) => (
              <NavButton key={loc.kind} loc={loc} labelKey={labelKey} Icon={icon} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
