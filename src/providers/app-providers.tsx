'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { brandingApi } from '@/shared/api/endpoints';
import { applyTenantBranding } from '@/shared/theme/apply-tenant-theme';
import { requestContext } from '@/shared/api/request-context';
import { useUiStore } from '@/features/shell/ui-store';
import { useA11yStore } from '@/features/accessibility/a11y-store';
import { useNotifPrefs } from '@/features/notifications/notification-prefs';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { LOCALE_COOKIE, isLocale } from '@/shared/i18n/config';
import { AuthBootstrap } from '@/features/auth/auth-bootstrap';

/**
 * Providers globais do cliente:
 *  - TanStack Query
 *  - Hidratação do tema (claro/escuro/sistema) e estado da sidebar
 *  - Branding do tenant via API (GET /branding, pelo subdomínio) → cor + logo + cultura + timezone
 *  - Bootstrap da sessão (re-hidrata via refresh token)
 *  - Toaster (notificações de UI)
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const hydrate = useUiStore((s) => s.hydrate);
  const hydrateA11y = useA11yStore((s) => s.hydrate);
  const hydrateNotifPrefs = useNotifPrefs((s) => s.hydrate);
  const setBranding = useBrandingStore((s) => s.setBranding);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    hydrate();
    hydrateA11y();
    hydrateNotifPrefs();

    // Branding do tenant a partir do subdomínio (anônimo). A API confirma no
    // registro [Admin].[Tenants] e devolve whitelabel/logo/cor/cultura/timezone.
    void brandingApi
      .get()
      .then((branding) => {
        setBranding(branding);
        applyTenantBranding(branding);
        if (branding.timeZone) requestContext.setTimeZone(branding.timeZone);

        // Cultura default do tenant aplicada só se o usuário ainda não escolheu.
        const hasLocaleCookie = document.cookie.includes(`${LOCALE_COOKIE}=`);
        if (!hasLocaleCookie && isLocale(branding.culture)) {
          document.cookie = `${LOCALE_COOKIE}=${branding.culture}; path=/; max-age=31536000; samesite=lax`;
          router.refresh();
        }
      })
      .catch(() => {
        /* tenant desconhecido / API fora → mantém branding e tema padrão Orbit */
      });
  }, [hydrate, hydrateA11y, hydrateNotifPrefs, setBranding, router]);

  return (
    <QueryClientProvider client={client}>
      <AuthBootstrap>{children}</AuthBootstrap>
      <Toaster richColors position="bottom-center" theme="system" />
    </QueryClientProvider>
  );
}
