'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, Volume2, Monitor, ArrowLeft, Play, AlertTriangle } from 'lucide-react';
import {
  useNotifPrefs,
  notificationPermission,
  requestNotificationPermission,
  playNotificationSound,
} from '@/features/notifications/notification-prefs';
import { cn } from '@/shared/lib/utils';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary', checked ? 'bg-primary' : 'bg-border')}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const t = useTranslations('notifPrefs');
  const tNav = useTranslations('nav');
  const prefs = useNotifPrefs();
  const [perm, setPerm] = useState<ReturnType<typeof notificationPermission>>('default');

  useEffect(() => { setPerm(notificationPermission()); }, []);

  async function toggleDesktop(v: boolean) {
    if (v && notificationPermission() !== 'granted') {
      const result = await requestNotificationPermission();
      setPerm(result);
      if (result !== 'granted') { prefs.set('desktop', false); return; }
    }
    prefs.set('desktop', v);
  }

  const denied = perm === 'denied';
  const unsupported = perm === 'unsupported';

  return (
    <div className="mx-auto max-w-2xl p-lg">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> {tNav('settings')}
      </Link>

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Bell className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        {/* Desktop */}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Monitor className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-text">{t('desktop')}</p>
              <p className="mt-0.5 text-xs text-muted">{t('desktopDesc')}</p>
              {(denied || unsupported) && (
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-warning">
                  <AlertTriangle className="h-3 w-3" /> {unsupported ? t('unsupported') : t('denied')}
                </p>
              )}
            </div>
          </div>
          <Toggle checked={prefs.desktop} onChange={toggleDesktop} label={t('desktop')} />
        </div>

        {/* Som */}
        <div className="flex items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Volume2 className="h-4 w-4" /></span>
            <div>
              <p className="text-sm font-semibold text-text">{t('sound')}</p>
              <p className="mt-0.5 text-xs text-muted">{t('soundDesc')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => playNotificationSound()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium text-muted hover:text-text"
            >
              <Play className="h-3.5 w-3.5" /> {t('test')}
            </button>
            <Toggle checked={prefs.sound} onChange={(v) => prefs.set('sound', v)} label={t('sound')} />
          </div>
        </div>
      </div>
    </div>
  );
}
