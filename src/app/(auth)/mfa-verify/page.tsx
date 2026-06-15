'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { mfaApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { tokenStore } from '@/shared/api/token-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { OtpInput } from '@/shared/ui/otp-input';

/** Verificação de MFA após o login (código TOTP de 6 dígitos ou de recuperação). */
export default function MfaVerifyPage() {
  const t = useTranslations('mfa');
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const markMfaVerified = useAuthStore((s) => s.markMfaVerified);

  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Sem sessão pendente → volta ao login. (Se já autenticado, segue pro dashboard.)
  useEffect(() => {
    if (!tokenStore.hasSession()) router.replace('/login');
    else if (status === 'authenticated') router.replace('/workspace');
  }, [status, router]);

  async function submit(value: string) {
    if (submitting) return;
    setSubmitting(true);
    try {
      await mfaApi.validate(value);
      markMfaVerified();
      router.replace('/workspace');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('invalidCode')));
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  // Auto-submete quando o TOTP completa 6 dígitos.
  useEffect(() => {
    if (!recovery && code.length === 6) void submit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, recovery]);

  return (
    <div className="rounded-lg border border-border bg-panel p-xl shadow">
      <h1 className="text-xl font-bold">{t('verifyTitle')}</h1>
      <p className="mb-lg mt-sm text-sm text-muted">{t('verifySubtitle')}</p>

      {recovery ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void submit(code.trim());
          }}
          className="flex flex-col gap-md"
        >
          <Input
            autoFocus
            placeholder="XXXXX-XXXXX"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center font-mono uppercase tracking-widest"
          />
          <Button type="submit" loading={submitting} className="w-full justify-center">
            {submitting ? t('verifying') : t('verify')}
          </Button>
        </form>
      ) : (
        <>
          <OtpInput value={code} onChange={setCode} disabled={submitting} />
          <Button
            onClick={() => void submit(code)}
            loading={submitting}
            disabled={code.length < 6}
            className="mt-md w-full justify-center"
          >
            {submitting ? t('verifying') : t('verify')}
          </Button>
        </>
      )}

      <button
        type="button"
        onClick={() => {
          setRecovery((v) => !v);
          setCode('');
        }}
        className="mt-md w-full text-center text-sm text-primary hover:underline"
      >
        {recovery ? t('useTotp') : t('useRecovery')}
      </button>
    </div>
  );
}
