'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles, FlaskConical, Layers, Activity, ShieldCheck } from 'lucide-react';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Logo } from '@/features/shell/logo';

/** Painel de marca (lado esquerdo) — imersivo, compartilhado por todas as telas de auth. */
export function AuthBrandPanel() {
  const t = useTranslations('login');
  const branding = useBrandingStore((s) => s.branding);

  const features = [
    { icon: FlaskConical, label: t('feature1') },
    { icon: Layers, label: t('feature2') },
    { icon: Activity, label: t('feature3') },
  ];

  return (
    <aside
      className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
      style={{
        background:
          'radial-gradient(circle at 25% 15%, var(--orbit-color-primary-soft), transparent 50%), linear-gradient(155deg, #0a0f1f 0%, #0d1430 55%, #0a1228 100%)',
      }}
    >
      {/* Órbitas decorativas */}
      <div className="pointer-events-none absolute -right-24 top-1/2 -translate-y-1/2" aria-hidden>
        {[360, 540, 720].map((s, i) => (
          <div
            key={s}
            className="absolute rounded-full border border-white/10"
            style={{ width: s, height: s, left: -s / 2, top: -s / 2, animation: `orbit-spin ${40 + i * 16}s linear infinite${i % 2 ? ' reverse' : ''}` }}
          >
            <span className="absolute h-2 w-2 rounded-full bg-white/70 shadow-[0_0_14px_3px_rgba(255,255,255,0.5)]" style={{ top: -4, left: s / 2 - 4 }} />
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute left-1/4 top-1/3 h-72 w-72 rounded-full blur-[120px] opacity-50"
        style={{ background: 'var(--orbit-color-primary)' }}
        aria-hidden
      />

      <div className="relative z-10 flex items-center gap-3">
        <Logo size={34} showWordmark={!branding?.hasWhitelabel} />
      </div>

      <div className="relative z-10 max-w-md">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
          <Sparkles className="h-3.5 w-3.5" /> Resolution Intelligence
        </span>
        <h2 className="mt-5 text-3xl font-bold leading-tight tracking-tight">{t('brandHeadline')}</h2>
        <p className="mt-3 text-sm leading-relaxed text-white/70">{t('brandSubcopy')}</p>

        <ul className="mt-8 flex flex-col gap-3.5">
          {features.map((f) => (
            <li key={f.label} className="flex items-center gap-3 text-sm text-white/85">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">
                <f.icon className="h-4 w-4" />
              </span>
              {f.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-white/55">
        <ShieldCheck className="h-3.5 w-3.5" /> {t('securityNote')}
      </div>
    </aside>
  );
}

/**
 * Estrutura split-screen das telas de autenticação: painel de marca + área do
 * formulário centralizada. `overlay` é renderizado cobrindo a coluna do formulário
 * (ex.: estado de "redirecionando" no login).
 */
export function AuthSplit({ children, overlay }: { children: ReactNode; overlay?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <AuthBrandPanel />
      <section className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        {overlay}
        <div className="w-full max-w-[420px] animate-rise">{children}</div>
      </section>
      <style>{`@keyframes orbit-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
