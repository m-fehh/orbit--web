'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Globe } from 'lucide-react';
import { locales, localeNames, LOCALE_COOKIE, type Locale } from '@/shared/i18n/config';
import { cn } from '@/shared/lib/utils';

/** Troca de cultura em tela (pt-BR / en-US / es-ES), persistida em cookie. */
export function LanguageSwitcher() {
  const t = useTranslations('language');
  const current = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function choose(locale: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-1.5 rounded px-sm text-sm text-muted hover:bg-panel-2 hover:text-text"
        aria-label={t('label')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">{current}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-1 w-48 overflow-hidden rounded border border-border bg-panel shadow-lg"
          >
            {locales.map((locale) => (
              <li key={locale}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale === current}
                  onClick={() => choose(locale)}
                  className={cn(
                    'flex w-full items-center justify-between px-md py-sm text-sm hover:bg-panel-2',
                    locale === current && 'text-primary',
                  )}
                >
                  {localeNames[locale]}
                  <span className="font-mono text-xs text-dim">{locale}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
