'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LogOut, Shield, Settings } from 'lucide-react';
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
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg"
        aria-label={user?.name}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials || '?'}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1 w-56 overflow-hidden rounded border border-border bg-panel shadow-lg"
          >
            <div className="border-b border-border px-md py-sm">
              <p className="truncate text-sm font-medium text-text">{user?.name}</p>
              <p className="truncate text-xs text-muted">{user?.email}</p>
            </div>
            <Link
              href="/settings/security"
              onClick={() => setOpen(false)}
              className="flex items-center gap-sm px-md py-sm text-sm hover:bg-panel-2"
              role="menuitem"
            >
              <Shield className="h-4 w-4 text-muted" aria-hidden /> {t('security')}
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-sm px-md py-sm text-sm hover:bg-panel-2"
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-muted" aria-hidden /> {t('settings')}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-sm border-t border-border px-md py-sm text-sm text-danger hover:bg-panel-2"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" aria-hidden /> {t('logout')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
