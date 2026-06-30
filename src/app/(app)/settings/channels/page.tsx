'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MessageCircle, Mail, Plus, Pencil, Trash2, ArrowLeft, X, Check, Loader2, Radio, Info } from 'lucide-react';
import { channelRegistryApi } from '@/shared/api/endpoints';
import { requestContext } from '@/shared/api/request-context';
import { ChannelType, apiErrorMessage, type ChannelResponse, type ChannelTypeValue } from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { cn } from '@/shared/lib/utils';

interface FormState {
  id: number | null;
  type: ChannelTypeValue;
  name: string;
  identifier: string;
  endpoint: string;
  apiKey: string;        // WhatsApp: access token · Email: chave do transporte
  phoneNumberId: string; // WhatsApp (Meta)
  verifyToken: string;   // WhatsApp (Meta)
  appSecret: string;     // WhatsApp (Meta)
  active: boolean;
}

const EMPTY: FormState = {
  id: null, type: ChannelType.WhatsApp, name: '', identifier: '', endpoint: '',
  apiKey: '', phoneNumberId: '', verifyToken: '', appSecret: '', active: true,
};

function webhookUrl(): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  return `${base}/channels/${requestContext.getTenant()}/whatsapp/inbound`;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors', checked ? 'bg-primary' : 'bg-border')}>
      <span className={cn('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-dim">{label}</label>
      {children}
      {hint && <span className="text-[11px] text-dim">{hint}</span>}
    </div>
  );
}

export default function ChannelsSettingsPage() {
  const t = useTranslations('channels');
  const tNav = useTranslations('nav');
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const list = useQuery({ queryKey: ['channels', 'registry'], queryFn: () => channelRegistryApi.list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['channels', 'registry'] });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const body = {
        name: f.name.trim(),
        identifier: f.identifier || null,
        endpoint: f.endpoint || null,
        apiKey: f.apiKey || null,
        phoneNumberId: f.phoneNumberId || null,
        verifyToken: f.verifyToken || null,
        appSecret: f.appSecret || null,
        active: f.active,
      };
      return f.id ? channelRegistryApi.update(f.id, body) : channelRegistryApi.create({ type: f.type, ...body });
    },
    onSuccess: (_d, f) => { invalidate(); setForm(null); toast.success(f.id ? t('updated') : t('created')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('error'))),
  });

  const remove = useMutation({
    mutationFn: (id: number) => channelRegistryApi.remove(id),
    onSuccess: () => { invalidate(); toast.success(t('removed')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('error'))),
  });

  const channels = list.data ?? [];
  const isWa = form?.type === ChannelType.WhatsApp;

  function startEdit(c: ChannelResponse) {
    setForm({
      id: c.id, type: c.type, name: c.name, identifier: c.identifier ?? '', endpoint: c.endpoint ?? '',
      apiKey: '', phoneNumberId: c.phoneNumberId ?? '', verifyToken: c.verifyToken ?? '', appSecret: '', active: c.active,
    });
  }

  return (
    <div className="mx-auto max-w-2xl p-lg">
      <Link href="/settings" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-3.5 w-3.5" /> {tNav('settings')}
      </Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary"><Radio className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-text">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>
        </div>
        {!form && <Button onClick={() => setForm({ ...EMPTY })}><Plus className="h-4 w-4" /> {t('add')}</Button>}
      </div>

      {/* Formulário */}
      {form && (
        <div className="mt-5 rounded-2xl border border-border bg-panel p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-text">{form.id ? t('edit') : t('add')}</p>
            <button type="button" onClick={() => setForm(null)} className="grid h-7 w-7 place-items-center rounded-lg text-dim hover:bg-panel-2 hover:text-text"><X className="h-4 w-4" /></button>
          </div>

          <div className="flex flex-col gap-4">
            {!form.id && (
              <Field label={t('type')}>
                <Select<ChannelTypeValue>
                  value={form.type}
                  onChange={(v) => setForm({ ...form, type: v })}
                  options={[
                    { value: ChannelType.WhatsApp, label: t('typeWhatsApp') },
                    { value: ChannelType.Email, label: t('typeEmail') },
                  ]}
                />
              </Field>
            )}

            <Field label={t('name')}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('namePh')} />
            </Field>

            {isWa ? (
              <>
                <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>{t('metaIntro')}</span>
                </div>
                <Field label={t('displayNumber')} hint={t('displayNumberHint')}>
                  <Input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="+55 11 99999-9999" />
                </Field>
                <Field label={t('phoneNumberId')} hint={t('phoneNumberIdHint')}>
                  <Input value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })} placeholder="1234567890" />
                </Field>
                <Field label={t('accessToken')} hint={form.id ? t('keepBlank') : undefined}>
                  <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="EAAG…" />
                </Field>
                <Field label={t('verifyToken')} hint={t('verifyTokenHint')}>
                  <Input value={form.verifyToken} onChange={(e) => setForm({ ...form, verifyToken: e.target.value })} placeholder="orbit-webhook-2024" />
                </Field>
                <Field label={t('appSecret')} hint={form.id ? t('keepBlank') : t('appSecretHint')}>
                  <Input type="password" value={form.appSecret} onChange={(e) => setForm({ ...form, appSecret: e.target.value })} placeholder="••••••••" />
                </Field>
                <div className="rounded-xl border border-border bg-bg-subtle/50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-dim">{t('webhookUrl')}</p>
                  <code className="mt-1 block break-all text-xs text-text">{webhookUrl()}</code>
                </div>
              </>
            ) : (
              <>
                <Field label={t('identifier')}>
                  <Input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder={t('identifierEmailPh')} />
                </Field>
                <Field label={t('endpoint')} hint={t('endpointDesc')}>
                  <Input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} placeholder="https://…" />
                </Field>
                <Field label={t('apiKey')} hint={form.id ? t('keepBlank') : undefined}>
                  <Input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder="••••••••" />
                </Field>
              </>
            )}

            <label className="flex items-center justify-between">
              <span className="text-sm font-medium text-text">{t('active')}</span>
              <Toggle checked={form.active} onChange={(v) => setForm({ ...form, active: v })} label={t('active')} />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setForm(null)}>{t('cancel')}</Button>
            <Button onClick={() => save.mutate(form)} loading={save.isPending} disabled={form.name.trim().length < 2}>
              <Check className="h-4 w-4" /> {t('save')}
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className="mt-5 flex flex-col gap-3">
        {list.isLoading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-dim" /></div>
        ) : channels.length === 0 && !form ? (
          <div className="rounded-2xl border border-dashed border-border bg-bg-subtle/40 px-6 py-12 text-center">
            <Radio className="mx-auto h-8 w-8 text-dim opacity-30" />
            <p className="mt-3 text-sm font-medium text-text">{t('none')}</p>
            <p className="mt-1 text-xs text-muted">{t('noneHint')}</p>
          </div>
        ) : (
          channels.map((c) => {
            const wa = c.type === ChannelType.WhatsApp;
            const configured = wa ? (!!c.phoneNumberId && c.hasApiKey) : c.hasApiKey;
            return (
              <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-4 shadow-sm">
                <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', wa ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-primary/10 text-primary')}>
                  {wa ? <MessageCircle className="h-5 w-5" /> : <Mail className="h-5 w-5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text">{c.name}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', c.active ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim')}>
                      {c.active ? t('statusActive') : t('statusInactive')}
                    </span>
                    {!configured && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-bold text-warning">{t('incomplete')}</span>}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {wa ? t('typeWhatsApp') : t('typeEmail')}{c.identifier ? ` · ${c.identifier}` : ''}
                  </p>
                </div>
                <button type="button" onClick={() => startEdit(c)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('edit')}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => { if (window.confirm(t('deleteConfirm'))) remove.mutate(c.id); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger" aria-label={t('delete')}>
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
