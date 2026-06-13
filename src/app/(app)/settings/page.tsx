'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Shield, ChevronRight } from 'lucide-react';

/** Índice de configurações. Por ora, leva à Segurança (MFA). */
export default function SettingsPage() {
  const t = useTranslations('nav');
  return (
    <div className="mx-auto max-w-xl p-lg">
      <h1 className="text-2xl font-bold">{t('settings')}</h1>
      <div className="mt-lg overflow-hidden rounded-lg border border-border bg-panel shadow-sm">
        <Link
          href="/settings/security"
          className="flex items-center gap-md px-lg py-md hover:bg-panel-2"
        >
          <Shield className="h-5 w-5 text-primary" aria-hidden />
          <span className="flex-1 text-sm font-medium">{t('security')}</span>
          <ChevronRight className="h-4 w-4 text-dim" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
