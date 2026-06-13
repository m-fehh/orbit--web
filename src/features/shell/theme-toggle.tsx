'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUiStore, type ThemeMode } from '@/features/shell/ui-store';

const order: ThemeMode[] = ['light', 'dark', 'system'];
const icons: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Alterna claro → escuro → sistema. */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const Icon = icons[theme];

  return (
    <button
      type="button"
      onClick={() => setTheme(order[(order.indexOf(theme) + 1) % order.length])}
      className="inline-flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-panel-2 hover:text-text"
      aria-label={`${t('toggle')} (${t(theme)})`}
      title={t(theme)}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
