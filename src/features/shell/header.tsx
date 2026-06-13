'use client';

import { Menu } from 'lucide-react';
import { useUiStore } from '@/features/shell/ui-store';
import { GlobalSearch } from '@/features/search/global-search';
import { NotificationCenter } from '@/features/notifications/notification-center';
import { Logo } from './logo';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { UserMenu } from './user-menu';

/** Header do shell: menu, marca, busca global, notificações, tema, idioma, usuário. */
export function Header() {
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <header className="glass sticky top-0 z-30 flex h-14 items-center gap-md border-b border-border/60 px-md">
      <button
        type="button"
        onClick={toggleSidebar}
        className="inline-flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-panel-2 hover:text-text md:hidden"
        aria-label="Menu"
      >
        <Menu className="h-4 w-4" aria-hidden />
      </button>

      <Logo size={24} className="shrink-0" />

      <div className="flex flex-1 justify-center px-md">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1">
        <NotificationCenter />
        <LanguageSwitcher />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
