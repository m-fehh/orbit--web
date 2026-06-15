/** Culturas suportadas pelo Orbit. */
export const locales = ['pt-BR', 'en-US', 'es-ES'] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'pt-BR';

/** Nome de exibição de cada cultura (no próprio idioma). */
export const localeNames: Record<Locale, string> = {
  'pt-BR': 'Português (Brasil)',
  'en-US': 'English (US)',
  'es-ES': 'Español (España)',
};

/** Bandeira (emoji) de cada cultura, para o seletor de idioma. */
export const localeFlags: Record<Locale, string> = {
  'pt-BR': '🇧🇷',
  'en-US': '🇺🇸',
  'es-ES': '🇪🇸',
};

/** Cookie onde a preferência de cultura do usuário é persistida. */
export const LOCALE_COOKIE = 'orbit-locale';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}
