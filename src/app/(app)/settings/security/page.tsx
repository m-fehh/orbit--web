'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { mfaApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { OtpInput } from '@/shared/ui/otp-input';

type Stage = 'idle' | 'setup' | 'recovery' | 'disable';

/** Setup/gestão de MFA na tela de Segurança. */
export default function SecurityPage() {
  const t = useTranslations('mfa');
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [stage, setStage] = useState<Stage>('idle');
  const [otpAuthUri, setOtpAuthUri] = useState('');
  const [manualKey, setManualKey] = useState('');
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const enabled = !!user?.twoFactorEnabled;

  async function startSetup() {
    setBusy(true);
    try {
      const res = await mfaApi.setup();
      setOtpAuthUri(res.otpAuthUri);
      setManualKey(res.manualEntryKey);
      setStage('setup');
    } catch (err) {
      toast.error(apiErrorMessage(err, t('invalidCode')));
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    setBusy(true);
    try {
      const res = await mfaApi.enable(code);
      setRecoveryCodes(res.recoveryCodes);
      setStage('recovery');
      setCode('');
      if (user) setUser({ ...user, twoFactorEnabled: true });
      toast.success(t('enabled'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('invalidCode')));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDisable() {
    setBusy(true);
    try {
      await mfaApi.disable(code);
      if (user) setUser({ ...user, twoFactorEnabled: false });
      setStage('idle');
      setCode('');
      toast.success(t('disabled'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('invalidCode')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl p-lg">
      <h1 className="text-2xl font-bold">{t('setupTitle')}</h1>

      <div className="mt-lg rounded-lg border border-border bg-panel p-lg shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">{t('status')}</p>
            <p className={`text-sm ${enabled ? 'text-success' : 'text-muted'}`}>
              {enabled ? t('statusEnabled') : t('statusDisabled')}
            </p>
          </div>
          {enabled ? (
            stage !== 'disable' && (
              <Button variant="danger" size="sm" onClick={() => { setCode(''); setStage('disable'); }} loading={busy}>
                {t('disable')}
              </Button>
            )
          ) : (
            stage === 'idle' && (
              <Button size="sm" onClick={startSetup} loading={busy}>
                {t('enable')}
              </Button>
            )
          )}
        </div>

        {stage === 'disable' && (
          <div className="mt-lg flex flex-col gap-md border-t border-border pt-lg">
            <p className="text-sm text-muted">{t('disableIntro')}</p>
            <OtpInput value={code} onChange={setCode} disabled={busy} />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => { setStage('idle'); setCode(''); }} className="flex-1 justify-center">
                {t('cancel')}
              </Button>
              <Button variant="danger" onClick={confirmDisable} loading={busy} disabled={code.length < 6} className="flex-1 justify-center">
                {t('disable')}
              </Button>
            </div>
          </div>
        )}

        {stage === 'setup' && (
          <div className="mt-lg flex flex-col gap-md border-t border-border pt-lg">
            <p className="text-sm text-muted">{t('setupIntro')}</p>
            <div className="flex justify-center rounded bg-white p-md">
              <QRCodeSVG value={otpAuthUri} size={180} />
            </div>
            <p className="text-xs text-muted">
              {t('manualKey')} <code className="font-mono text-text">{manualKey}</code>
            </p>
            <label className="text-sm font-medium">{t('confirmCode')}</label>
            <OtpInput value={code} onChange={setCode} disabled={busy} />
            <Button onClick={confirmEnable} loading={busy} disabled={code.length < 6} className="w-full justify-center">
              {t('enable')}
            </Button>
          </div>
        )}

        {stage === 'recovery' && (
          <div className="mt-lg flex flex-col gap-md border-t border-border pt-lg">
            <p className="text-sm font-medium">{t('recoveryTitle')}</p>
            <p className="text-xs text-muted">{t('recoveryIntro')}</p>
            <ul className="grid grid-cols-2 gap-sm rounded bg-bg-subtle p-md font-mono text-sm">
              {recoveryCodes.map((rc) => (
                <li key={rc}>{rc}</li>
              ))}
            </ul>
            <Button variant="secondary" onClick={() => setStage('idle')} className="w-full justify-center">
              {t('recoveryDone')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
