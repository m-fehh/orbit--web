'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { locales, localeNames, LOCALE_COOKIE, type Locale } from '@/shared/i18n/config';
import { Flag } from './flag';
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
        className="inline-flex h-9 w-9 items-center justify-center rounded text-base hover:bg-panel-2"
        aria-label={t('label')}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={localeNames[current]}
      >
        <Flag locale={current} className="rounded-sm shadow-sm" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <ul
            role="listbox"
            className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-md border border-border bg-panel shadow-lg"
          >
            {locales.map((locale) => (
              <li key={locale}>
                <button
                  type="button"
                  role="option"
                  aria-selected={locale === current}
                  onClick={() => choose(locale)}
                  className={cn(
                    'flex w-full items-center gap-sm px-md py-sm text-sm hover:bg-panel-2',
                    locale === current && 'text-primary',
                  )}
                >
                  <Flag locale={locale} className="rounded-sm shadow-sm" />
                  <span className="flex-1 text-left">{localeNames[locale]}</span>
                  {locale === current && <Check className="h-4 w-4" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
