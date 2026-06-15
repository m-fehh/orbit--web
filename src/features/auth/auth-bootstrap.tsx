'use client';

import { useEffect, useRef } from 'react';
import { authApi } from '@/shared/api/endpoints';
import { tokenStore } from '@/shared/api/token-store';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Re-hidrata a sessão ao carregar o app: o access token vive em memória e some
 * no reload, mas o refresh token persiste. Chamamos /auth/me — o interceptor
 * dispara o refresh automaticamente quando o access token está ausente/expirado.
 * Se houver refresh válido, a sessão é considerada autenticada (o MFA já foi
 * validado no login que a originou).
 */
export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const setUser = useAuthStore((s) => s.setUser);
  const setStatus = useAuthStore((s) => s.setStatus);
  const syncPermissions = useAuthStore((s) => s.syncPermissionsFromToken);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!tokenStore.hasSession()) {
      setStatus('unauthenticated');
      return;
    }

    authApi
      .me()
      .then((user) => {
        setUser(user);
        syncPermissions(); // token já foi renovado pelo interceptor; lê as claims
        setStatus('authenticated');
      })
      .catch(() => {
        tokenStore.clear();
        setStatus('unauthenticated');
      });
  }, [setUser, setStatus]);

  return <>{children}</>;
}
