'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogOut, Shield, Settings, ChevronDown, Accessibility, Sparkles, Sun, Moon, Monitor, Keyboard } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { useAuthStore } from '@/features/auth/auth-store';
import { useUiStore, type ThemeMode } from '@/features/shell/ui-store';
import { useTourStore } from '@/features/tour/tour-store';
import { useShortcutsStore } from '@/features/shortcuts/shortcuts-store';
import { cn } from '@/shared/lib/utils';

const THEME_OPTIONS: { value: ThemeMode; icon: typeof Sun }[] = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Monitor },
];

/** Avatar + menu do usuário (tema, segurança/MFA, acessibilidade, atalhos, tour, logout). */
export function UserMenu({ variant = 'header', collapsed = false }: { variant?: 'header' | 'sidebar'; collapsed?: boolean } = {}) {
  const t = useTranslations('nav');
  const tA11y = useTranslations('a11y');
  const tTheme = useTranslations('theme');
  const tTour = useTranslations('tour');
  const tShortcuts = useTranslations('shortcuts');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const startTour = useTourStore((s) => s.start);
  const openShortcuts = useShortcutsStore((s) => s.openHelp);
  const [open, setOpen] = useState(false);

  const initials = (user?.name ?? '?')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      /* mesmo em falha, encerramos a sessão local */
    }
    reset();
    router.replace('/login');
  }

  const items = [
    { href: '/settings/security', icon: Shield, label: t('security') },
    { href: '/settings/accessibility', icon: Accessibility, label: tA11y('title') },
    { href: '/settings', icon: Settings, label: t('settings') },
  ];

  const isSidebar = variant === 'sidebar';

  return (
    <div className={cn('relative', isSidebar && 'w-full')}>
      {isSidebar ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition-colors hover:bg-panel-2',
            open && 'bg-panel-2',
            collapsed && 'justify-center p-1.5',
          )}
          aria-label={user?.name}
          aria-haspopup="menu"
          aria-expanded={open}
          title={collapsed ? user?.name : undefined}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded bg-primary text-xs font-bold text-primary-fg ring-primary/15">
            {initials || '?'}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-semibold text-text">{user?.name}</span>
                <span className="block truncate text-[11px] text-muted">{user?.email}</span>
              </span>
              <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-dim transition-transform', open && 'rotate-180')} aria-hidden />
            </>
          )}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 rounded-full border py-0.5 pl-0.5 pr-1 transition-all sm:pr-2.5',
            open ? 'border-primary/40 bg-primary/5' : 'border-border bg-panel hover:border-border-strong hover:bg-panel-2',
          )}
          aria-label={user?.name}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg ring-2 ring-primary/15">
            {initials || '?'}
          </span>
          <span className="hidden min-w-0 flex-col items-start leading-tight lg:flex">
            <span className="max-w-[140px] truncate text-sm font-semibold text-text">{user?.name}</span>
            {user?.role && <span className="max-w-[140px] truncate text-[10px] text-dim">{user.role}</span>}
          </span>
          <ChevronDown className={cn('hidden h-3.5 w-3.5 text-dim transition-transform lg:inline', open && 'rotate-180')} aria-hidden />
        </button>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className={cn(
              'absolute z-40 w-72 max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-border bg-panel shadow-2xl animate-rise',
              isSidebar ? 'bottom-full left-0 mb-2' : 'right-0 mt-2',
            )}
          >
            {/* Cabeçalho */}
            <div className="flex items-center gap-3 border-b border-border p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-primary text-base font-bold text-primary-fg ring-primary/15">
                {initials || '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>

            {/* Tema */}
            <div className="border-b border-border px-3 py-3">
              <p className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-dim">{tTheme('toggle')}</p>
              <div className="flex gap-1 rounded-xl bg-bg-subtle p-1">
                {THEME_OPTIONS.map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    aria-pressed={theme === value}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors',
                      theme === value ? 'bg-panel text-primary shadow-sm' : 'text-muted hover:text-text',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden /> {tTheme(value)}
                  </button>
                ))}
              </div>
            </div>

            {/* Itens */}
            <div className="p-1.5">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition-colors hover:bg-panel-2"
                >
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-bg-subtle text-muted">
                    <it.icon className="h-4 w-4" aria-hidden />
                  </span>
                  {it.label}
                </Link>
              ))}
              <button
                type="button"
                onClick={() => { setOpen(false); openShortcuts(); }}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition-colors hover:bg-panel-2"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-bg-subtle text-muted">
                  <Keyboard className="h-4 w-4" aria-hidden />
                </span>
                {tShortcuts('title')}
              </button>
              <button
                type="button"
                onClick={() => { setOpen(false); startTour(); }}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-text transition-colors hover:bg-panel-2"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-bg-subtle text-muted">
                  <Sparkles className="h-4 w-4" aria-hidden />
                </span>
                {tTour('start')}
              </button>
            </div>

            <div className="border-t border-border p-1.5">
              <button
                type="button"
                onClick={logout}
                role="menuitem"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-danger/10">
                  <LogOut className="h-4 w-4" aria-hidden />
                </span>
                {t('logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
