'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Shield, Accessibility, Bell, Radio, Library, ChevronRight, type LucideIcon, Settings as SettingsIcon } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth-store';

interface SettingsCard {
  href: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  badgeKey?: string;
}

export default function SettingsPage() {
  const t = useTranslations('settings');
  const user = useAuthStore((s) => s.user);

  const cards: SettingsCard[] = [
    { href: '/settings/security', icon: Shield, titleKey: 'securityTitle', descKey: 'securityDesc', badgeKey: user?.twoFactorEnabled ? 'mfaOn' : 'mfaOff' },
    { href: '/settings/accessibility', icon: Accessibility, titleKey: 'a11yTitle', descKey: 'a11yDesc' },
    { href: '/settings/notifications', icon: Bell, titleKey: 'notifTitle', descKey: 'notifDesc' },
    { href: '/settings/channels', icon: Radio, titleKey: 'channelsTitle', descKey: 'channelsDesc' },
  ];

  return (
    <div className="mx-auto max-w-2xl p-lg">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <SettingsIcon className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-panel p-5 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <c.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-text">{t(c.titleKey)}</p>
                {c.badgeKey && (
                  <span className={c.badgeKey === 'mfaOn'
                    ? 'rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success'
                    : 'rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-bold text-dim'}>
                    {t(c.badgeKey)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{t(c.descKey)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
