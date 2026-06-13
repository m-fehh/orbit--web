import { tenantSlugFromHost } from '@/features/tenant/tenant-settings';
import { defaultLocale, LOCALE_COOKIE, type Locale } from '@/shared/i18n/config';

/**
 * Contexto ambiente injetado em TODA requisição pelo interceptor:
 * tenant (subdomínio), cultura (cookie) e timezone (preferência do tenant/usuário).
 * Mantido em módulo para ser acessível fora do React.
 */
let timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

export const requestContext = {
  /** Slug do tenant a partir do host atual (para o header X-Tenant-Id pré-login). */
  getTenant(): string {
    if (typeof window === 'undefined') {
      return process.env.NEXT_PUBLIC_DEFAULT_TENANT || 'default';
    }
    return tenantSlugFromHost(window.location.host);
  },

  /** Cultura corrente (lida do cookie persistido pelo LanguageSwitcher). */
  getLocale(): Locale {
    if (typeof document === 'undefined') return defaultLocale;
    const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]+)`));
    return (match?.[1] as Locale) || defaultLocale;
  },

  getTimeZone: () => timeZone,
  setTimeZone: (tz: string) => {
    if (tz) timeZone = tz;
  },
};
