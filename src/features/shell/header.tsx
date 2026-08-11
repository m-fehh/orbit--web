'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Settings, SlidersHorizontal, Webhook, Activity, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/features/shell/ui-store';
import { usePermissions } from '@/features/auth/use-permissions';
import { useTabStore, type TabLocation } from '@/features/workspace/tab-store';
import { CommandPalette } from '@/features/search/command-palette';
import { NotificationCenter } from '@/features/notifications/notification-center';
import { ConfigModal } from '@/features/config/config-modal';
import { Portal } from '@/shared/ui/portal';
import { Logo } from './logo';
import { LanguageSwitcher } from './language-switcher';

/** Header do shell: menu (mobile), marca, busca global, notificações, Administração, idioma. */
export function Header() {
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const { can } = usePermissions();
  const tConfig = useTranslations('config');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const openTab = useTabStore((s) => s.openTab);

  const [menuOpen, setMenuOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const canConfig = can('config.view');
  const canWebhooks = can('webhook.view');
  const canSystem = can('admin.system.migrate');
  const showAdmin = canConfig || canWebhooks || canSystem;

  function openView(loc: TabLocation) {
    setMenuOpen(false);
    openTab(loc);
    router.push('/workspace');
  }

  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-sm border-b border-border px-sm sm:gap-md sm:px-md">
      <button
        type="button"
        onClick={() => setMobileNav(true)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text md:hidden"
        aria-label="Menu"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <Logo size={24} className="mr-sm shrink-0" />

      <div className="flex-1" />

      <div className="flex items-center gap-0.5 sm:gap-1">
        <span data-tour="search" className="inline-flex">
          <CommandPalette />
        </span>
        <span data-tour="notifications" className="inline-flex">
          <NotificationCenter />
        </span>

        {showAdmin && (
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text"
            aria-label={tNav('secAdmin')}
            title={tNav('secAdmin')}
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
        )}

        <div data-tour="language" className="hidden sm:block">
          <LanguageSwitcher />
        </div>
      </div>

      {/* Menu Administração (dropdown via Portal — header tem backdrop-filter) */}
      {menuOpen && showAdmin && (
        <Portal>
          <div className="fixed inset-0 z-[60]" onClick={() => setMenuOpen(false)} aria-hidden />
          <div
            role="menu"
            aria-label={tNav('secAdmin')}
            className="fixed right-3 top-14 z-[61] w-60 overflow-hidden rounded-lg border border-border bg-panel py-1 shadow-xl"
          >
            <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-dim">{tNav('secAdmin')}</p>
            {canConfig && (
              <AdminMenuItem
                icon={SlidersHorizontal}
                label={tConfig('title')}
                onClick={() => { setMenuOpen(false); setConfigOpen(true); }}
              />
            )}
            {canWebhooks && (
              <AdminMenuItem
                icon={Webhook}
                label={tNav('webhooks')}
                onClick={() => openView({ kind: 'webhooks', params: {}, title: 'Webhooks', icon: 'admin' })}
              />
            )}
            {canSystem && (
              <AdminMenuItem
                icon={Activity}
                label={tNav('system')}
                onClick={() => openView({ kind: 'system', params: {}, title: 'Saúde do Sistema', icon: 'admin' })}
              />
            )}
          </div>
        </Portal>
      )}

      {canConfig && <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />}
    </header>
  );
}

function AdminMenuItem({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-muted transition-colors hover:bg-panel-2 hover:text-text"
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}
