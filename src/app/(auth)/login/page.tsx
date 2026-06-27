'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ShieldCheck } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Logo } from '@/features/shell/logo';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

/** Tela de Login. */
export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const setSessionFromLogin = useAuthStore((s) => s.setSessionFromLogin);
  const branding = useBrandingStore((s) => s.branding);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const auth = await authApi.login(values.email, values.password);
      setSessionFromLogin(auth);
      router.replace(auth.user.twoFactorEnabled ? '/mfa-verify' : '/workspace');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('genericError')));
    }
  }

  return (
    <div className="glass top-hairline relative overflow-hidden rounded-2xl border border-border/60 p-xl shadow-2xl">
      {/* brilho superior */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{ background: 'linear-gradient(90deg, transparent, var(--orbit-color-primary), transparent)' }}
        aria-hidden
      />

      <div className="mb-xl flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 rounded-2xl blur-2xl" style={{ background: 'var(--orbit-color-primary-soft)' }} aria-hidden />
          <Logo size={44} showWordmark={!branding?.hasWhitelabel} className="animate-float" />
        </div>
        <h1 className="mt-lg text-2xl font-bold gradient-text">{t('title')}</h1>
        <p className="mt-1.5 text-sm text-muted">{t('subtitle')}</p>
        {branding?.name && (
          <span className="mt-md inline-flex items-center gap-1.5 rounded-full border border-border bg-panel-2/60 px-md py-1 text-xs text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            {branding.name}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium text-text">{t('email')}</label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            inputSize="lg"
            prefix={<Mail className="h-4 w-4" />}
            placeholder="voce@empresa.com"
            invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <span className="text-xs text-danger">{t('emailRequired')}</span>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-medium text-text">{t('password')}</label>
            <Link href="/forgot-password" className="text-xs font-medium text-primary transition-colors hover:text-primary/80 hover:underline">
              {t('forgot')}
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            inputSize="lg"
            prefix={<Lock className="h-4 w-4" />}
            placeholder="••••••••"
            invalid={!!errors.password}
            aria-invalid={!!errors.password}
            showLabel={t('showPassword')}
            hideLabel={t('hidePassword')}
            {...register('password')}
          />
          {errors.password && <span className="text-xs text-danger">{t('passwordRequired')}</span>}
        </div>

        <Button type="submit" loading={isSubmitting} className="mt-sm h-12 w-full justify-center gap-2 text-base">
          {isSubmitting ? t('submitting') : (<>{t('submit')} <ArrowRight className="h-4 w-4" /></>)}
        </Button>
      </form>

      <p className="mt-lg flex items-center justify-center gap-1.5 text-center text-[11px] text-dim">
        <ShieldCheck className="h-3 w-3" />
        {t('securityNote')}
      </p>
    </div>
  );
}
