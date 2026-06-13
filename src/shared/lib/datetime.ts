import type { Locale } from '@/shared/i18n/config';

/**
 * Formatação de datas respeitando timezone do tenant/usuário e a cultura.
 * O backend persiste e retorna SEMPRE em UTC (ISO8601 com Z); a conversão para
 * o fuso de exibição acontece aqui, na borda do front.
 */
export function formatDateTime(
  iso: string | Date | null | undefined,
  opts: { locale: Locale; timeZone: string; withTime?: boolean },
): string {
  if (!iso) return '—';
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat(opts.locale, {
    timeZone: opts.timeZone,
    dateStyle: 'medium',
    timeStyle: opts.withTime === false ? undefined : 'short',
  }).format(date);
}

/** Tempo relativo ("há 5 min"), útil para notificações. */
export function formatRelative(iso: string | Date, locale: Locale): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso;
  const diffMs = date.getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (abs < hour) return rtf.format(Math.round(diffMs / min), 'minute');
  if (abs < day) return rtf.format(Math.round(diffMs / hour), 'hour');
  return rtf.format(Math.round(diffMs / day), 'day');
}
