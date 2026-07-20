'use client';

import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Activity, Inbox, Webhook, Cog, RefreshCw, AlertTriangle } from 'lucide-react';
import { internalApi } from '@/shared/api/endpoints';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';
import type { Locale } from '@/shared/i18n/config';

/** Uma estatística numérica com rótulo; realça em vermelho quando é uma contagem de falhas > 0. */
function Stat({ label, value, danger }: { label: string; value: number | string; danger?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border bg-bg-subtle/50 px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{label}</span>
      <span className={cn('text-lg font-bold tabular-nums', danger ? 'text-danger' : 'text-text')}>{value}</span>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: typeof Inbox; title: string; children: React.ReactNode }) {
  return (
    <div className="card-surface flex flex-col gap-3 p-lg">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
        <h2 className="text-sm font-bold text-text">{title}</h2>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>
    </div>
  );
}

/** Painel de saúde operacional (admin): Outbox, webhooks e filas do Hangfire. */
export function SystemHealthView() {
  const t = useTranslations('systemHealth');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['system', 'health'],
    queryFn: () => internalApi.system.health(),
    refetchInterval: 15_000,
    retry: false,
  });

  if (isLoading) return <LoadingState label={t('loading')} />;
  if (isError || !data) return <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  const hf = data.hangfire;

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-auto p-lg">
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted hover:bg-panel-2 hover:text-text"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> {t('refresh')}
          </button>
        </header>

        <Card icon={Inbox} title={t('outbox')}>
          <Stat label={t('pending')} value={data.outbox.pending} />
          <Stat label={t('failed')} value={data.outbox.failed} danger={data.outbox.failed > 0} />
          <Stat label={t('oldestPending')} value={data.outbox.oldestPendingUtc ? formatDateTime(data.outbox.oldestPendingUtc, { locale, timeZone }) : '—'} />
        </Card>

        <Card icon={Webhook} title={t('webhooks')}>
          <Stat label={t('pending')} value={data.webhooks.pending} />
          <Stat label={t('failed')} value={data.webhooks.failed} danger={data.webhooks.failed > 0} />
        </Card>

        <Card icon={Cog} title={t('hangfire')}>
          {data.hangfireAvailable && hf ? (
            <>
              <Stat label={t('servers')} value={hf.servers} danger={hf.servers === 0} />
              <Stat label={t('enqueued')} value={hf.enqueued} />
              <Stat label={t('scheduled')} value={hf.scheduled} />
              <Stat label={t('processing')} value={hf.processing} />
              <Stat label={t('succeeded')} value={hf.succeeded} />
              <Stat label={t('failedJobs')} value={hf.failed} danger={hf.failed > 0} />
            </>
          ) : (
            <p className="col-span-full flex items-center gap-2 text-xs text-dim">
              <AlertTriangle className="h-4 w-4 text-warning" /> {t('hangfireOff')}
            </p>
          )}
        </Card>

        <p className="text-xs text-dim">{t('generatedAt', { time: formatDateTime(data.generatedAtUtc, { locale, timeZone }) })}</p>
      </div>
    </div>
  );
}
