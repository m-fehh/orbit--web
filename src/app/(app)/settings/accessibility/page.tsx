'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Accessibility, Contrast, Type, Underline, ZoomIn, Gauge, RotateCcw, ArrowLeft, Check } from 'lucide-react';
import { useA11yStore, type FontScale } from '@/features/accessibility/a11y-store';
import { cn } from '@/shared/lib/utils';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary',
        checked ? 'bg-primary' : 'bg-border',
      )}
    >
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

function Row({ icon: Icon, title, desc, children }: { icon: typeof Contrast; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-text">{title}</p>
          <p className="mt-0.5 text-xs text-muted">{desc}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function AccessibilityPage() {
  const t = useTranslations('a11y');
  const tNav = useTranslations('nav');
  const s = useA11yStore();

  const scales: { value: FontScale; label: string }[] = [
    { value: 'base', label: t('fontSizeBase') },
    { value: 'lg', label: t('fontSizeLg') },
    { value: 'xl', label: t('fontSizeXl') },
  ];

  return (
    <div className="mx-auto max-w-2xl p-lg">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> {tNav('settings')}
      </Link>

      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Accessibility className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </div>

      {/* Tamanho do texto */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Type className="h-4 w-4" /></span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">{t('fontSize')}</p>
            <p className="mt-0.5 text-xs text-muted">{t('fontSizeDesc')}</p>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4">
          {scales.map((sc) => (
            <button
              key={sc.value}
              type="button"
              onClick={() => s.set('fontScale', sc.value)}
              aria-pressed={s.fontScale === sc.value}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors',
                s.fontScale === sc.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:border-border-strong hover:text-text',
              )}
            >
              {s.fontScale === sc.value && <Check className="h-3.5 w-3.5" />}
              {sc.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-panel shadow-sm">
        <Row icon={Contrast} title={t('highContrast')} desc={t('highContrastDesc')}>
          <Toggle checked={s.highContrast} onChange={(v) => s.set('highContrast', v)} label={t('highContrast')} />
        </Row>
        <Row icon={Gauge} title={t('reduceMotion')} desc={t('reduceMotionDesc')}>
          <Toggle checked={s.reduceMotion} onChange={(v) => s.set('reduceMotion', v)} label={t('reduceMotion')} />
        </Row>
        <Row icon={Underline} title={t('underlineLinks')} desc={t('underlineLinksDesc')}>
          <Toggle checked={s.underlineLinks} onChange={(v) => s.set('underlineLinks', v)} label={t('underlineLinks')} />
        </Row>
        <Row icon={ZoomIn} title={t('readableSpacing')} desc={t('readableSpacingDesc')}>
          <Toggle checked={s.readableSpacing} onChange={(v) => s.set('readableSpacing', v)} label={t('readableSpacing')} />
        </Row>
      </div>

      {/* Pré-visualização + reset */}
      <div className="mt-4 rounded-2xl border border-border bg-bg-subtle/50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">{t('preview')}</p>
        <p className="mt-2 text-sm text-text">{t('previewText')} <a href="#" onClick={(e) => e.preventDefault()} className="text-primary">{t('previewLink')}</a>.</p>
      </div>

      <button
        type="button"
        onClick={() => s.reset()}
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
      >
        <RotateCcw className="h-3.5 w-3.5" /> {t('reset')}
      </button>
    </div>
  );
}
