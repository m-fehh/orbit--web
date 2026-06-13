import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from './config';

/**
 * Resolve o locale por requisição (setup sem roteamento por path):
 *   1. cookie `orbit-locale` (preferência explícita do usuário, trocável em tela)
 *   2. header Accept-Language do browser
 *   3. defaultLocale (pt-BR)
 *
 * O default por TENANT é aplicado no cliente (escreve o cookie) quando o usuário
 * ainda não escolheu — ver AppProviders.
 */
export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: Locale = defaultLocale;
  if (isLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const accept = headers().get('accept-language') ?? '';
    const preferred = accept.split(',')[0]?.trim();
    if (isLocale(preferred)) locale = preferred;
  }

  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
