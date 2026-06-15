'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import type { Locale } from '@/shared/i18n/config';
import type { SlaSnapshotResponse } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/datetime';
import { cn } from '@/shared/lib/utils';

const COLOR: Record<SlaSnapshotResponse['status'], { text: string; bar: string; bg: string }> = {
  OnTrack: { text: 'text-success', bar: 'bg-success', bg: 'bg-success/10' },
  AtRisk: { text: 'text-warning', bar: 'bg-warning', bg: 'bg-warning/10' },
  Breached: { text: 'text-danger', bar: 'bg-danger', bg: 'bg-danger/10' },
  None: { text: 'text-dim', bar: 'bg-panel-2', bg: 'bg-panel-2' },
};

/** Formata "tempo restante" em algo humano, em qualquer ordem de grandeza. */
function fmtRemaining(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 1) return '< 1 min';
  if (abs < 60) return `${Math.round(abs)} min`;
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  if (abs < 60 * 24) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh > 0 ? `${d}d ${rh}h` : `${d}d`;
}

/** Calcula percentual consumido para a barra de progresso (0..100, "saturado" se estourado). */
function consumedPct(sla: SlaSnapshotResponse): number {
  if (!sla.dueAt) return 0;
  if (sla.status === 'Breached') return 100;
  if (sla.minutesRemaining == null) return 0;
  const due = new Date(sla.dueAt).getTime();
  const now = Date.now();
  const totalMs = due - now + sla.minutesRemaining * 60_000 * 0; // dueAt já desconta o consumido
  // Usamos minutesRemaining como sinal de "quanto falta"; estimativa simples:
  // se não temos início, mostramos verde até AtRisk (≤20%), depois aproximamos.
  if (sla.status === 'AtRisk') return 85;
  if (sla.status === 'OnTrack') return Math.max(5, Math.min(70, 100 - (sla.minutesRemaining * 60_000 / Math.max(1, due - now + 1)) * 100));
  void totalMs;
  return 0;
}

/**
 * Painel rico de SLA: status, contador regressivo, due date e barra visual.
 * Mostrado no detalhe do ticket e reaproveitável em modais/dashboards.
 */
export function SlaPanel({ sla, dense = false }: { sla: SlaSnapshotResponse | null | undefined; dense?: boolean }) {
  const tSla = useTranslations('sla');
  const locale = useLocale() as Locale;
  // Tick a cada 30s para o "tempo restante" não congelar.
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(i);
  }, []);

  if (!sla) {
    return <p className="text-sm text-dim">—</p>;
  }

  const c = COLOR[sla.status];
  const pct = consumedPct(sla);
  const Icon = sla.status === 'Breached' ? ShieldAlert : sla.status === 'OnTrack' ? ShieldCheck : Timer;

  if (dense) {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-1.5 text-sm font-medium', c.text)}>
        <Icon className="h-4 w-4" aria-hidden /> {tSla(sla.status)}
        {sla.dueAt && (
          <span className="text-dim">· {tSla('due')} {formatDateTime(sla.dueAt, { locale, timeZone: 'UTC' })}</span>
        )}
      </span>
    );
  }

  return (
    <div className={cn('rounded-md border border-border p-md', c.bg)}>
      <div className="flex items-center gap-sm">
        <Icon className={cn('h-5 w-5', c.text)} aria-hidden />
        <span className={cn('text-sm font-semibold', c.text)}>{tSla(sla.status)}</span>
        {sla.priority && (
          <span className="ml-auto rounded bg-panel/60 px-1.5 py-0.5 text-xs text-muted">{sla.priority}</span>
        )}
      </div>

      {sla.dueAt && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="uppercase tracking-wide text-dim">{tSla('due')}</p>
            <p className="font-medium text-text">{formatDateTime(sla.dueAt, { locale, timeZone: 'UTC' })}</p>
          </div>
          {sla.minutesRemaining != null && (
            <div>
              <p className="uppercase tracking-wide text-dim">
                {sla.minutesRemaining >= 0 ? tSla('remaining') : tSla('overdue')}
              </p>
              <p className={cn('font-semibold', c.text)}>{fmtRemaining(sla.minutesRemaining)}</p>
            </div>
          )}
        </div>
      )}

      {sla.dueAt && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
          <div className={cn('h-full transition-all', c.bar)} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}
