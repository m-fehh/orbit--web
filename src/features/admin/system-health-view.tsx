'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  Activity, Inbox, Webhook, Cog, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, Clock, ServerCrash, Zap,
} from 'lucide-react';
import { internalApi } from '@/shared/api/endpoints';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';
import type { Locale } from '@/shared/i18n/config';

type Severity = 'ok' | 'warn' | 'crit';

/** Tokens de cor/gradiente por severidade — usados no hero e nos realces. */
const TONE: Record<Severity, { dot: string; text: string; ring: string; softBg: string; heroFrom: string; heroTo: string; heroBorder: string }> = {
  ok: { dot: 'bg-success', text: 'text-success', ring: 'ring-success/30', softBg: 'bg-panel-2 text-muted', heroFrom: 'from-success/15', heroTo: 'to-success/[0.03]', heroBorder: 'border-success/25' },
  warn: { dot: 'bg-warning', text: 'text-warning', ring: 'ring-warning/30', softBg: 'bg-warning/10 text-warning', heroFrom: 'from-warning/15', heroTo: 'to-warning/[0.03]', heroBorder: 'border-warning/25' },
  crit: { dot: 'bg-danger', text: 'text-danger', ring: 'ring-danger/30', softBg: 'bg-danger/10 text-danger', heroFrom: 'from-danger/15', heroTo: 'to-danger/[0.03]', heroBorder: 'border-danger/25' },
};

/** Métrica grande com rótulo e ícone; realça a cor quando é uma contagem de falhas > 0. */
function Metric({ label, value, tone = 'ok', icon: Icon }: { label: string; value: number | string; tone?: Severity; icon?: typeof Inbox }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle/40 px-3.5 py-3">
      {Icon && (
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', TONE[tone].softBg)}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0">
        <div className={cn('text-2xl font-bold leading-none tabular-nums', TONE[tone].text, tone === 'ok' && 'text-text')}>{value}</div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-dim">{label}</div>
      </div>
    </div>
  );
}

/** Barra empilhada horizontal (segmentos coloridos proporcionais) com legenda. */
function StackBar({ segments }: { segments: { value: number; className: string; label: string }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel-2">
        {segments.map((s, i) =>
          s.value > 0 ? <div key={i} className={s.className} style={{ width: `${(s.value / total) * 100}%` }} /> : null,
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-[11px] text-muted">
            <span className={cn('h-2 w-2 rounded-full', s.className)} /> {s.label}: <b className="text-text tabular-nums">{s.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Panel({ icon: Icon, title, tone, children }: { icon: typeof Inbox; title: string; tone: Severity; children: React.ReactNode }) {
  return (
    <div className="card-surface flex flex-col gap-4 p-lg">
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary')}><Icon className="h-4 w-4" /></span>
        <h2 className="flex-1 text-sm font-bold text-text">{title}</h2>
        <span className={cn('h-2.5 w-2.5 rounded-full ring-4', TONE[tone].dot, TONE[tone].ring)} />
      </div>
      {children}
    </div>
  );
}

/** Painel de saúde operacional (admin): status geral, alertas acionáveis, Outbox, webhooks e Hangfire. */
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

  // Deriva verdicto geral + lista de alertas acionáveis a partir dos contadores.
  const derived = useMemo(() => {
    if (!data) return null;
    const hf = data.hangfire;
    const issues: { severity: Exclude<Severity, 'ok'>; icon: typeof AlertTriangle; text: string }[] = [];

    if (data.hangfireAvailable && hf && hf.servers === 0)
      issues.push({ severity: 'crit', icon: ServerCrash, text: t('issueNoServers') });
    if (data.outbox.failed > 0)
      issues.push({ severity: 'warn', icon: XCircle, text: t('issueOutboxFailed', { count: data.outbox.failed }) });
    if (data.webhooks.failed > 0)
      issues.push({ severity: 'warn', icon: XCircle, text: t('issueWebhookFailed', { count: data.webhooks.failed }) });
    if (hf && hf.failed > 0)
      issues.push({ severity: 'warn', icon: XCircle, text: t('issueJobsFailed', { count: hf.failed }) });

    // Outbox "parado": pendente mais antigo há > 1h.
    let outboxStaleMin = 0;
    if (data.outbox.oldestPendingUtc) {
      outboxStaleMin = Math.floor((Date.now() - new Date(data.outbox.oldestPendingUtc).getTime()) / 60000);
      if (outboxStaleMin > 60)
        issues.push({ severity: 'warn', icon: Clock, text: t('issueOutboxStale', { min: outboxStaleMin }) });
    }

    const status: Severity = issues.some((i) => i.severity === 'crit') ? 'crit' : issues.length > 0 ? 'warn' : 'ok';
    return { issues, status, outboxStaleMin };
  }, [data, t]);

  if (isLoading) return <LoadingState label={t('loading')} />;
  if (isError || !data || !derived) return <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  const hf = data.hangfire;
  const { status, issues } = derived;
  const tone = TONE[status];
  const StatusIcon = status === 'ok' ? CheckCircle2 : status === 'warn' ? AlertTriangle : XCircle;
  const statusLabel = status === 'ok' ? t('statusHealthy') : status === 'warn' ? t('statusDegraded') : t('statusCritical');
  const statusSummary =
    status === 'ok' ? t('summaryHealthy') : t('summaryIssues', { count: issues.length });

  // Taxa de sucesso do Hangfire (succeeded / (succeeded + failed)).
  const hfTotal = hf ? hf.succeeded + hf.failed : 0;
  const successRate = hfTotal > 0 ? Math.round((hf!.succeeded / hfTotal) * 100) : 100;
  const outboxTone: Severity = data.outbox.failed > 0 ? 'warn' : derived.outboxStaleMin > 60 ? 'warn' : 'ok';
  const webhookTone: Severity = data.webhooks.failed > 0 ? 'warn' : 'ok';
  const hfTone: Severity = hf && hf.servers === 0 ? 'crit' : hf && hf.failed > 0 ? 'warn' : 'ok';

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-auto p-lg">
        {/* Cabeçalho */}
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-subtle/50 px-2.5 py-1 text-[11px] text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            {t('live')}
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs text-muted hover:bg-panel-2 hover:text-text"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} /> {t('refresh')}
          </button>
        </header>

        {/* Hero de status geral */}
        <div className={cn('relative overflow-hidden rounded-2xl border bg-gradient-to-br p-lg', tone.heroBorder, tone.heroFrom, tone.heroTo)}>
          <div className="flex flex-wrap items-center gap-4">
            <span className={cn('grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-card/60 ring-1', tone.text, tone.ring)}>
              <StatusIcon className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <div className={cn('text-lg font-bold', tone.text)}>{statusLabel}</div>
              <p className="text-sm text-muted">{statusSummary}</p>
            </div>
            {/* Chips-resumo */}
            <div className="flex flex-wrap gap-2">
              <HeroChip label={t('outbox')} value={data.outbox.pending} tone={outboxTone} />
              <HeroChip label={t('webhooks')} value={data.webhooks.pending} tone={webhookTone} />
              {data.hangfireAvailable && hf && <HeroChip label={t('successRate')} value={`${successRate}%`} tone={hfTone} />}
            </div>
          </div>

          {/* Alertas acionáveis */}
          {issues.length > 0 && (
            <ul className="mt-4 flex flex-col gap-1.5 border-t border-border/60 pt-4">
              {issues.map((iss, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <iss.icon className={cn('h-4 w-4 shrink-0', TONE[iss.severity].text)} />
                  <span className="text-text">{iss.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Cartões de domínio */}
        <div className="grid gap-lg lg:grid-cols-2">
          <Panel icon={Inbox} title={t('outbox')} tone={outboxTone}>
            <StackBar
              segments={[
                { value: data.outbox.pending, className: 'bg-warning', label: t('pending') },
                { value: data.outbox.failed, className: 'bg-danger', label: t('failed') },
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              <Metric label={t('pending')} value={data.outbox.pending} tone={data.outbox.pending > 0 ? 'warn' : 'ok'} icon={Clock} />
              <Metric label={t('failed')} value={data.outbox.failed} tone={data.outbox.failed > 0 ? 'warn' : 'ok'} icon={XCircle} />
            </div>
            <p className="text-[11px] text-dim">
              {t('oldestPending')}: <span className="text-muted">{data.outbox.oldestPendingUtc ? formatDateTime(data.outbox.oldestPendingUtc, { locale, timeZone }) : '—'}</span>
            </p>
          </Panel>

          <Panel icon={Webhook} title={t('webhooks')} tone={webhookTone}>
            <StackBar
              segments={[
                { value: data.webhooks.pending, className: 'bg-warning', label: t('pending') },
                { value: data.webhooks.failed, className: 'bg-danger', label: t('failed') },
              ]}
            />
            <div className="grid grid-cols-2 gap-2">
              <Metric label={t('pending')} value={data.webhooks.pending} tone={data.webhooks.pending > 0 ? 'warn' : 'ok'} icon={Clock} />
              <Metric label={t('failed')} value={data.webhooks.failed} tone={data.webhooks.failed > 0 ? 'warn' : 'ok'} icon={XCircle} />
            </div>
          </Panel>

          <Panel icon={Cog} title={t('hangfire')} tone={hfTone}>
            {data.hangfireAvailable && hf ? (
              <>
                {/* Vazão: concluídos vs falhos */}
                <div className="flex items-center gap-4">
                  <SuccessGauge rate={successRate} tone={hfTone} label={t('successRate')} />
                  <div className="flex-1">
                    <StackBar
                      segments={[
                        { value: hf.succeeded, className: 'bg-success', label: t('succeeded') },
                        { value: hf.failed, className: 'bg-danger', label: t('failedJobs') },
                      ]}
                    />
                  </div>
                </div>
                {/* Estado das filas */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Metric label={t('servers')} value={hf.servers} tone={hf.servers === 0 ? 'crit' : 'ok'} icon={Zap} />
                  <Metric label={t('enqueued')} value={hf.enqueued} tone={hf.enqueued > 0 ? 'warn' : 'ok'} />
                  <Metric label={t('scheduled')} value={hf.scheduled} />
                  <Metric label={t('processing')} value={hf.processing} />
                </div>
              </>
            ) : (
              <p className="flex items-center gap-2 rounded-xl border border-border bg-bg-subtle/40 px-3.5 py-4 text-xs text-dim">
                <AlertTriangle className="h-4 w-4 text-warning" /> {t('hangfireOff')}
              </p>
            )}
          </Panel>
        </div>

        <p className="text-xs text-dim">{t('generatedAt', { time: formatDateTime(data.generatedAtUtc, { locale, timeZone }) })}</p>
      </div>
    </div>
  );
}

/** Chip compacto de resumo exibido no hero. */
function HeroChip({ label, value, tone }: { label: string; value: number | string; tone: Severity }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-border bg-card/60 px-4 py-2">
      <span className={cn('text-lg font-bold tabular-nums', TONE[tone].text, tone === 'ok' && 'text-text')}>{value}</span>
      <span className="text-[9px] font-semibold uppercase tracking-wider text-dim">{label}</span>
    </div>
  );
}

/** Medidor circular (conic-gradient) da taxa de sucesso. */
function SuccessGauge({ rate, tone, label }: { rate: number; tone: Severity; label: string }) {
  const color = tone === 'crit' ? 'var(--color-danger, #ef4444)' : tone === 'warn' ? 'var(--color-warning, #f59e0b)' : 'var(--color-success, #22c55e)';
  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center">
      <div
        className="h-20 w-20 rounded-full"
        style={{ background: `conic-gradient(${color} ${rate * 3.6}deg, var(--color-panel-2, #e5e7eb) 0deg)` }}
      />
      <div className="absolute grid h-14 w-14 place-items-center rounded-full bg-card">
        <span className={cn('text-base font-bold tabular-nums', TONE[tone].text, tone === 'ok' && 'text-text')}>{rate}%</span>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
