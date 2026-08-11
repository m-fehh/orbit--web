'use client';

import { useState } from 'react';
import { Menu, Settings } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/features/shell/ui-store';
import { usePermissions } from '@/features/auth/use-permissions';
import { CommandPalette } from '@/features/search/command-palette';
import { NotificationCenter } from '@/features/notifications/notification-center';
import { ConfigModal } from '@/features/config/config-modal';
import { Logo } from './logo';
import { LanguageSwitcher } from './language-switcher';

/** Header do shell: menu (mobile), marca, busca global, notificações, configurações, idioma. */
export function Header() {
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const { can } = usePermissions();
  const tConfig = useTranslations('config');
  const [configOpen, setConfigOpen] = useState(false);

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
        {can('config.view') && (
          <button
            type="button"
            onClick={() => setConfigOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text"
            aria-label={tConfig('title')}
            title={tConfig('title')}
          >
            <Settings className="h-4 w-4" aria-hidden />
          </button>
        )}
        <div data-tour="language" className="hidden sm:block">
          <LanguageSwitcher />
        </div>
      </div>

      {can('config.view') && <ConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />}
    </header>
  );
}
