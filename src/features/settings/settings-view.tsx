'use client';

import { useState, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, Accessibility, Bell, Settings as SettingsIcon, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth-store';
import { cn } from '@/shared/lib/utils';
import SecurityPage from '@/app/(app)/settings/security/page';
import AccessibilityPage from '@/app/(app)/settings/accessibility/page';
import NotificationsPage from '@/app/(app)/settings/notifications/page';

type SectionKey = 'security' | 'accessibility' | 'notifications';

interface Section {
  key: SectionKey;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  Component: ComponentType;
}

const SECTIONS: Section[] = [
  { key: 'security', icon: Shield, titleKey: 'securityTitle', descKey: 'securityDesc', Component: SecurityPage },
  { key: 'accessibility', icon: Accessibility, titleKey: 'a11yTitle', descKey: 'a11yDesc', Component: AccessibilityPage },
  { key: 'notifications', icon: Bell, titleKey: 'notifTitle', descKey: 'notifDesc', Component: NotificationsPage },
];

/** Configurações do usuário — dentro do workspace (drawer), com navegação lateral por seção. */
export function SettingsView() {
  const t = useTranslations('settings');
  const user = useAuthStore((s) => s.user);
  const [active, setActive] = useState<SectionKey>('security');

  const Active = SECTIONS.find((s) => s.key === active)!.Component;

  return (
    <div className="flex h-full min-h-0">
      {/* Menu lateral */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border">
        <div className="flex items-center gap-2.5 border-b border-border p-md">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
            <SettingsIcon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-text">{t('title')}</h1>
            <p className="truncate text-[11px] text-muted">{t('subtitle')}</p>
          </div>
        </div>

        <nav className="flex flex-col gap-1 p-sm">
          {SECTIONS.map((s) => {
            const isActive = s.key === active;
            const showMfaBadge = s.key === 'security';
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setActive(s.key)}
                className={cn(
                  'flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                  isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
                )}
              >
                <span className={cn(
                  'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-bg-subtle text-dim',
                )}>
                  <s.icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{t(s.titleKey)}</span>
                    {showMfaBadge && (
                      <span className={cn(
                        'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                        user?.twoFactorEnabled ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim',
                      )}>
                        {t(user?.twoFactorEnabled ? 'mfaOn' : 'mfaOff')}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-dim">{t(s.descKey)}</span>
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Conteúdo da seção */}
      <section className="min-w-0 flex-1 overflow-auto">
        <Active />
      </section>
    </div>
  );
}
