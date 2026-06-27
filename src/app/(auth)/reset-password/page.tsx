'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Lock, KeyRound, ArrowLeft, Check, X, ShieldCheck } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { Logo } from '@/features/shell/logo';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';
import { cn } from '@/shared/lib/utils';

/** Regras de caracteres aplicadas à nova senha. */
const PASSWORD_RULES: { key: string; test: (v: string) => boolean }[] = [
  { key: 'len', test: (v) => v.length >= 8 },
  { key: 'upper', test: (v) => /[A-Z]/.test(v) },
  { key: 'lower', test: (v) => /[a-z]/.test(v) },
  { key: 'number', test: (v) => /[0-9]/.test(v) },
  { key: 'special', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

const STRENGTH_COLORS = ['bg-danger', 'bg-danger', 'bg-warning', 'bg-warning', 'bg-success', 'bg-success'];

function ResetPasswordForm() {
  const t = useTranslations('resetPassword');
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState(params.get('email') ?? '');
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const ruleState = useMemo(() => PASSWORD_RULES.map((r) => ({ key: r.key, ok: r.test(password) })), [password]);
  const passedCount = ruleState.filter((r) => r.ok).length;
  const allRulesOk = passedCount === PASSWORD_RULES.length;
  const matches = confirm.length > 0 && confirm === password;
  const canSubmit = !!email.trim() && !!token.trim() && allRulesOk && matches && !submitting;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await authApi.resetPassword(email.trim(), token.trim(), password);
      toast.success(t('resetSuccess'));
      router.replace('/login');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('resetError')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glass top-hairline relative overflow-hidden rounded-2xl border border-border/60 p-xl shadow-2xl">
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--orbit-color-primary), transparent)' }}
        aria-hidden
      />

      <div className="mb-lg flex flex-col items-center text-center">
        <Logo size={40} className="animate-float" />
        <h1 className="mt-lg text-2xl font-bold gradient-text">{t('resetTitle')}</h1>
        <p className="mt-1.5 max-w-xs text-sm text-muted">{t('resetSubtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-md" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-text">{t('email')}</label>
          <Input
            id="email" type="email" autoComplete="email" inputSize="lg"
            prefix={<Mail className="h-4 w-4" />} placeholder="voce@empresa.com"
            value={email} onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="token" className="text-sm font-medium text-text">{t('code')}</label>
          <Input
            id="token" autoComplete="one-time-code" inputSize="lg"
            prefix={<KeyRound className="h-4 w-4" />} placeholder={t('codePlaceholder')}
            value={token} onChange={(e) => setToken(e.target.value)}
            className="font-mono tracking-wider"
          />
          <span className="flex items-center gap-1.5 text-[11px] text-dim">
            <ShieldCheck className="h-3 w-3 text-primary" /> {t('codeHint')}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-text">{t('newPassword')}</label>
          <PasswordInput
            id="password" autoComplete="new-password" inputSize="lg"
            prefix={<Lock className="h-4 w-4" />} placeholder="••••••••"
            value={password} onChange={(e) => setPassword(e.target.value)}
            showLabel={t('showPassword')} hideLabel={t('hidePassword')}
          />

          {/* Medidor de força */}
          <div className="mt-1 flex gap-1">
            {Array.from({ length: PASSWORD_RULES.length }).map((_, i) => (
              <span
                key={i}
                className={cn('h-1 flex-1 rounded-full transition-colors', i < passedCount ? STRENGTH_COLORS[passedCount] : 'bg-border')}
              />
            ))}
          </div>

          {/* Checklist de regras */}
          <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            {ruleState.map((r) => (
              <li key={r.key} className={cn('flex items-center gap-1.5 text-[11px] transition-colors', r.ok ? 'text-success' : 'text-dim')}>
                <span className={cn('grid h-3.5 w-3.5 place-items-center rounded-full', r.ok ? 'bg-success/15' : 'bg-panel-2')}>
                  {r.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                </span>
                {t(`rules.${r.key}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-sm font-medium text-text">{t('confirmPassword')}</label>
          <PasswordInput
            id="confirm" autoComplete="new-password" inputSize="lg"
            prefix={<Lock className="h-4 w-4" />} placeholder="••••••••"
            value={confirm} onChange={(e) => setConfirm(e.target.value)}
            invalid={confirm.length > 0 && !matches}
            showLabel={t('showPassword')} hideLabel={t('hidePassword')}
          />
          {confirm.length > 0 && !matches && <span className="text-xs text-danger">{t('mismatch')}</span>}
        </div>

        <Button type="submit" loading={submitting} disabled={!canSubmit} className="mt-sm h-12 w-full justify-center text-base">
          {submitting ? t('resetting') : t('resetCta')}
        </Button>
      </form>

      <Link href="/login" className="mt-lg inline-flex w-full items-center justify-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> {t('backToLogin')}
      </Link>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
