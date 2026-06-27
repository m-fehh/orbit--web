'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, ShieldCheck, Loader2 } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Logo } from '@/features/shell/logo';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { PasswordInput } from '@/shared/ui/password-input';
import { AuthSplit } from '@/features/auth/auth-split';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
type FormValues = z.infer<typeof schema>;

/** Tela de Login — split-screen: painel de marca + formulário. */
export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const setSessionFromLogin = useAuthStore((s) => s.setSessionFromLogin);
  const branding = useBrandingStore((s) => s.branding);

  // Mantém o feedback de loading durante a navegação pós-login (a rota destino
  // leva alguns segundos para montar). Esta página desmonta ao navegar.
  const [redirecting, setRedirecting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      const auth = await authApi.login(values.email, values.password);
      setSessionFromLogin(auth);
      setRedirecting(true);
      router.replace(auth.user.twoFactorEnabled ? '/mfa-verify' : '/workspace');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('genericError')));
    }
  }

  const busy = isSubmitting || redirecting;

  return (
    <AuthSplit
      overlay={redirecting && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-bg/85 backdrop-blur-sm">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
          <p className="text-sm font-medium text-text">{t('redirecting')}</p>
        </div>
      )}
    >
      {/* Cabeçalho (logo só aparece no mobile, já que o painel some) */}
      <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
        <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-bg-subtle shadow-sm lg:hidden">
          <Logo size={32} showWordmark={false} />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text">{t('title')}</h1>
        <p className="mt-2 text-sm text-muted">{t('subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
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

        <Button type="submit" loading={busy} className="mt-sm h-12 w-full justify-center gap-2 text-base">
          {busy ? t('submitting') : (<>{t('submit')} <ArrowRight className="h-4 w-4" /></>)}
        </Button>
      </form>
    </AuthSplit>
  );
}
