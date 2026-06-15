'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { authApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Logo } from '@/features/shell/logo';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

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
      // Exibe a mensagem da API (já localizada); fallback genérico pela cultura.
      toast.error(apiErrorMessage(err, t('genericError')));
    }
  }

  return (
    <div className="glass top-hairline rounded-lg p-xl shadow-lg">
      <div className="mb-lg flex flex-col items-center text-center">
        <Logo size={40} showWordmark={!branding?.hasWhitelabel} className="animate-float" />
        <h1 className="mt-lg text-2xl font-bold gradient-text">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('subtitle')}</p>
        {branding?.name && (
          <span className="mt-md rounded-full border border-border bg-panel-2/60 px-md py-1 text-xs text-muted">
            {branding.name}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md" noValidate>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('email')}
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="voce@empresa.com"
            invalid={!!errors.email}
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && <span className="text-xs text-danger">{t('emailRequired')}</span>}
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('password')}
          <Input
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={!!errors.password}
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && <span className="text-xs text-danger">{t('passwordRequired')}</span>}
        </label>

        <Button type="submit" loading={isSubmitting} className="mt-sm w-full justify-center">
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </div>
  );
}
