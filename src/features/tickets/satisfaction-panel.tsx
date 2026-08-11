'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Star } from 'lucide-react';
import { satisfactionApi } from '@/shared/api/endpoints';
import { usePermissions } from '@/features/auth/use-permissions';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import type { Locale } from '@/shared/i18n/config';
import { cn } from '@/shared/lib/utils';

/**
 * Painel de satisfação (CSAT) no detalhe do ticket: registra/exibe a nota do solicitante (1–5) +
 * comentário. Visível com `satisfaction.view`; editável com `satisfaction.submit` (upsert). Sem
 * permissão de ver, não renderiza nada.
 */
export function SatisfactionPanel({ ticketId }: { ticketId: number }) {
  const t = useTranslations('satisfaction');
  const tc = useTranslations('common');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const { can } = usePermissions();
  const canView = can('satisfaction.view');
  const canSubmit = can('satisfaction.submit');
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['satisfaction', ticketId],
    queryFn: () => satisfactionApi.get(ticketId),
    enabled: canView,
  });

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hover, setHover] = useState(0);
  useEffect(() => {
    setRating(data?.rating ?? 0);
    setComment(data?.comment ?? '');
  }, [data]);

  const submit = useMutation({
    mutationFn: () => satisfactionApi.submit(ticketId, rating, comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['satisfaction', ticketId] }),
  });

  if (!canView) return null;

  const readOnly = !canSubmit;
  const dirty = rating > 0 && (rating !== (data?.rating ?? 0) || (comment ?? '') !== (data?.comment ?? ''));

  return (
    <div className="card-surface p-lg">
      <div className="mb-3 flex items-center gap-2">
        <Star className="h-4 w-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">{t('title')}</h3>
      </div>

      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = (hover || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              onMouseEnter={() => !readOnly && setHover(n)}
              onClick={() => !readOnly && setRating(n)}
              aria-label={String(n)}
              className={cn('rounded p-0.5 transition-transform', !readOnly ? 'hover:scale-110' : 'cursor-default')}
            >
              <Star
                className={cn('h-6 w-6', active ? 'text-warning' : 'text-dim')}
                style={{ fill: active ? 'currentColor' : 'none' }}
                aria-hidden
              />
            </button>
          );
        })}
        {rating > 0 && <span className="ml-2 text-sm font-semibold text-text">{rating}/5</span>}
      </div>

      {(!readOnly || !!data?.comment) && (
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={readOnly}
          rows={2}
          placeholder={t('commentPlaceholder')}
          className="mt-3 w-full resize-none rounded border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-text outline-none focus:border-primary disabled:opacity-70"
        />
      )}

      {data?.respondedAt && (
        <p className="mt-2 text-[11px] text-dim">{t('respondedAt', { date: formatDateTime(data.respondedAt, { locale, timeZone }) })}</p>
      )}

      {!readOnly && (
        <button
          type="button"
          onClick={() => submit.mutate()}
          disabled={!dirty || submit.isPending}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {data ? tc('save') : t('submit')}
        </button>
      )}

      {readOnly && !data && <p className="mt-1 text-sm text-muted">{t('notRated')}</p>}
    </div>
  );
}
