'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Mail, ArrowLeft, ArrowRight, MailCheck, KeyRound } from 'lucide-react';
import { authApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { Logo } from '@/features/shell/logo';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { AuthSplit } from '@/features/auth/auth-split';

const schema = z.object({ email: z.string().email() });
type FormValues = z.infer<typeof schema>;

/** Solicitação de redefinição de senha — envia o código por e-mail. */
export default function ForgotPasswordPage() {
  const t = useTranslations('resetPassword');
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    try {
      await authApi.forgotPassword(values.email);
      setSentTo(values.email);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('genericError')));
    }
  }

  return (
    <AuthSplit>
      {sentTo ? (
        <div className="flex flex-col items-center text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success ring-1 ring-success/20">
            <MailCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-lg text-xl font-bold text-text">{t('sentTitle')}</h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted">
            {t('sentBody', { email: sentTo })}
          </p>
          <Link
            href={{ pathname: '/reset-password', query: { email: sentTo } }}
            className="mt-lg w-full"
          >
            <Button className="h-11 w-full justify-center gap-2">
              <KeyRound className="h-4 w-4" /> {t('haveCode')}
            </Button>
          </Link>
          <Link href="/login" className="mt-md inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> {t('backToLogin')}
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-border bg-bg-subtle shadow-sm lg:hidden">
              <Logo size={32} showWordmark={false} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">{t('forgotTitle')}</h1>
            <p className="mt-2 text-sm text-muted">{t('forgotSubtitle')}</p>
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

            <Button type="submit" loading={isSubmitting} className="mt-sm h-12 w-full justify-center gap-2 text-base">
              {isSubmitting ? t('sending') : (<>{t('sendCode')} <ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </form>

          <div className="mt-lg flex items-center justify-center gap-4 text-sm">
            <Link href="/login" className="inline-flex items-center gap-1.5 text-muted hover:text-text">
              <ArrowLeft className="h-3.5 w-3.5" /> {t('backToLogin')}
            </Link>
            <span className="text-border">·</span>
            <Link
              href={{ pathname: '/reset-password', query: getValues('email') ? { email: getValues('email') } : undefined }}
              className="text-primary hover:underline"
            >
              {t('haveCode')}
            </Link>
          </div>
        </>
      )}
    </AuthSplit>
  );
}
