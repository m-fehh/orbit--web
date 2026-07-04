'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ShieldAlert, ShieldCheck, Timer } from 'lucide-react';
import type { Locale } from '@/shared/i18n/config';
import type { SlaSnapshotResponse } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/datetime';
import { cn } from '@/shared/lib/utils';

const COLOR: Record<SlaSnapshotResponse['status'], { text: string; bar: string; bg: string; ring: string }> = {
  OnTrack: { text: 'text-success', bar: 'bg-success', bg: 'bg-success/10', ring: 'ring-success/25' },
  AtRisk: { text: 'text-warning', bar: 'bg-warning', bg: 'bg-warning/10', ring: 'ring-warning/25' },
  Breached: { text: 'text-danger', bar: 'bg-danger', bg: 'bg-danger/10', ring: 'ring-danger/25' },
  None: { text: 'text-dim', bar: 'bg-panel-2', bg: 'bg-panel-2', ring: 'ring-border' },
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
export function SlaPanel({ sla, dense = false, bare = false }: { sla: SlaSnapshotResponse | null | undefined; dense?: boolean; bare?: boolean }) {
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
    <div className={cn('overflow-hidden', bare ? 'rounded-lg border border-border' : 'card-surface')}>
      {/* Header: título do card + pílula de status (distinto dos labels internos) */}
      <div className="flex items-center gap-2 border-b border-border px-md py-2.5">
        <Timer className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden />
        <span className="flex-1 truncate text-[11px] font-semibold uppercase tracking-wider text-dim">{tSla('label')}</span>
        <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium', c.bg, c.text)}>
          <Icon className="h-3 w-3" aria-hidden /> {tSla(sla.status)}
        </span>
      </div>

      <div className="p-md">
        {sla.dueAt ? (
          <>
            <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
              <div className={cn('h-full rounded-full transition-all duration-500', c.bar)} style={{ width: `${pct}%` }} />
            </div>
            {sla.minutesRemaining != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-dim">{sla.minutesRemaining >= 0 ? tSla('remaining') : tSla('overdue')}</span>
                <span className={cn('font-semibold', c.text)}>{fmtRemaining(sla.minutesRemaining)}</span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between text-[11px] text-dim">
              <span>{tSla('due')}</span>
              <span className="tabular-nums">{formatDateTime(sla.dueAt, { locale, timeZone: 'UTC' })}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-dim">{tSla(sla.status)}</p>
        )}
      </div>
    </div>
  );
}
