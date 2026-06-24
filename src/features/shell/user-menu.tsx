'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogOut, Shield, Settings, ChevronDown } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { useAuthStore } from '@/features/auth/auth-store';

/** Avatar + menu do usuário (acesso à segurança/MFA e logout). */
export function UserMenu() {
  const t = useTranslations('nav');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const reset = useAuthStore((s) => s.reset);
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-panel py-0.5 pl-0.5 pr-2 transition-colors hover:border-border-strong"
        aria-label={user?.name}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-fg ring-primary/20">
          {initials || '?'}
        </span>
        <span className="hidden max-w-[120px] truncate text-sm font-medium lg:inline">{user?.name}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-dim lg:inline" aria-hidden />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
          >
            <div className="flex items-center gap-sm border-b border-border p-md">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-primary text-sm font-bold text-primary-fg">
                {initials || '?'}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">{user?.name}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
                {user?.role && (
                  <span className="mt-1 inline-block rounded bg-panel-2 px-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                    {user.role}
                  </span>
                )}
              </div>
            </div>
            <div className="p-1">
              <Link
                href="/settings/security"
                onClick={() => setOpen(false)}
                className="flex items-center gap-sm rounded-md px-md py-2 text-sm hover:bg-panel-2"
                role="menuitem"
              >
                <Shield className="h-4 w-4 text-muted" aria-hidden /> {t('security')}
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-sm rounded-md px-md py-2 text-sm hover:bg-panel-2"
                role="menuitem"
              >
                <Settings className="h-4 w-4 text-muted" aria-hidden /> {t('settings')}
              </Link>
            </div>
            <div className="border-t border-border p-1">
              <button
                type="button"
                onClick={logout}
                className="flex w-full items-center gap-sm rounded-md px-md py-2 text-sm text-danger hover:bg-danger/10"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" aria-hidden /> {t('logout')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
