'use client';

import { Menu, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore } from '@/features/shell/ui-store';
import { useTourStore } from '@/features/tour/tour-store';
import { CommandPalette } from '@/features/search/command-palette';
import { NotificationCenter } from '@/features/notifications/notification-center';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { UserMenu } from './user-menu';

/** Header do shell: menu (mobile), marca, busca global, notificações, tema, idioma, usuário. */
export function Header() {
  const setMobileNav = useUiStore((s) => s.setMobileNav);
  const startTour = useTourStore((s) => s.start);
  const tTour = useTranslations('tour');

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

      <div data-tour="search" className="flex flex-1 px-sm">
        <CommandPalette />
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={() => startTour()}
          className="hidden h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-panel-2 hover:text-text sm:inline-flex"
          aria-label={tTour('start')}
          title={tTour('start')}
        >
          <HelpCircle className="h-4 w-4" aria-hidden />
        </button>
        <span data-tour="notifications" className="inline-flex">
          <NotificationCenter />
        </span>
        <div data-tour="language" className="hidden sm:block">
          <LanguageSwitcher />
        </div>
        <span data-tour="theme" className="inline-flex">
          <ThemeToggle />
        </span>
        <span data-tour="user" className="inline-flex">
          <UserMenu />
        </span>
      </div>
    </header>
  );
}
