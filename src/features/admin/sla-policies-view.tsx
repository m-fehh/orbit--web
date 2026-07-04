'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Gauge, Save, Clock, CheckCircle2, CalendarClock } from 'lucide-react';
import { slaPoliciesApi, businessHoursApi } from '@/shared/api/endpoints';
import {
  Priority, apiErrorMessage,
  type PriorityName, type PriorityValue, type SlaPolicyResponse, type BusinessHoursResponse,
} from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Checkbox } from '@/shared/ui/checkbox';
import { PageTransition, LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };

/** Expediente do tenant — quando ativo, o SLA conta só em horário útil. */
function BusinessHoursCard() {
  const t = useTranslations('slaSettings');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['business-hours'], queryFn: () => businessHoursApi.get() });

  const [form, setForm] = useState<BusinessHoursResponse | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const dayLabel = (iso: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, iso)));

  const save = useMutation({
    mutationFn: (body: BusinessHoursResponse) => businessHoursApi.save(body),
    onSuccess: () => { toast.success(t('hoursSaved')); qc.invalidateQueries({ queryKey: ['business-hours'] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  if (!form) return null;
  const activeDays = new Set(form.workDays.split(',').map((d) => Number(d.trim())).filter(Boolean));
  const toggleDay = (iso: number) => {
    const next = new Set(activeDays);
    if (next.has(iso)) next.delete(iso); else next.add(iso);
    setForm({ ...form, workDays: [...next].sort((a, b) => a - b).join(',') });
  };

  return (
    <div className="rounded-xl border border-border bg-panel p-md">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-info/10 text-info">
          <CalendarClock className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text">{t('businessHours')}</h2>
          <p className="text-xs text-muted">{t('businessHoursHint')}</p>
        </div>
        <Checkbox checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })} label={t('enabled')} />
      </div>

      {form.enabled && (
        <div className="mt-md flex flex-wrap items-end gap-lg">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('workDays')}</span>
            <div className="flex flex-wrap gap-1">
              {ISO_DAYS.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={cn(
                    'h-8 min-w-9 rounded-md border px-2 text-xs font-medium capitalize transition-colors',
                    activeDays.has(iso) ? 'border-primary bg-primary/10 text-primary' : 'border-border text-dim hover:text-text',
                  )}
                >
                  {dayLabel(iso)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('start')}</span>
            <Input type="time" value={toHHMM(form.startMinute)} onChange={(e) => setForm({ ...form, startMinute: fromHHMM(e.target.value) })} className="h-9 w-32" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('end')}</span>
            <Input type="time" value={toHHMM(form.endMinute)} onChange={(e) => setForm({ ...form, endMinute: fromHHMM(e.target.value) })} className="h-9 w-32" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('timezone')}</span>
            <Input value={form.timeZoneId} onChange={(e) => setForm({ ...form, timeZoneId: e.target.value })} placeholder="America/Sao_Paulo" className="h-9 w-52" />
          </label>
        </div>
      )}

      <div className="mt-md flex justify-end">
        <Button loading={save.isPending} onClick={() => save.mutate(form)}>
          <Save className="h-4 w-4" /> {t('save')}
        </Button>
      </div>
    </div>
  );
}

const PRIORITIES: { name: PriorityName; value: PriorityValue }[] = [
  { name: 'Critical', value: Priority.Critical },
  { name: 'High', value: Priority.High },
  { name: 'Medium', value: Priority.Medium },
  { name: 'Low', value: Priority.Low },
];

const PRIORITY_ACCENT: Record<PriorityName, string> = {
  Critical: 'text-danger bg-danger/10 border-danger/30',
  High: 'text-warning bg-warning/10 border-warning/30',
  Medium: 'text-info bg-info/10 border-info/30',
  Low: 'text-muted bg-panel-2 border-border',
};

type Row = { firstResponseMinutes: number; resolutionMinutes: number };

export function SlaPoliciesView() {
  const t = useTranslations('slaSettings');
  const tPriority = useTranslations('priority');
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sla', 'policies'],
    queryFn: () => slaPoliciesApi.list(),
  });

  const [rows, setRows] = useState<Record<PriorityName, Row>>({} as Record<PriorityName, Row>);

  // Preenche o estado editável a partir das políticas salvas (0 quando ainda não configurada).
  useEffect(() => {
    if (!data) return;
    const byPriority = new Map<string, SlaPolicyResponse>(data.map((p) => [p.priority, p] as const));
    const next = {} as Record<PriorityName, Row>;
    for (const { name } of PRIORITIES) {
      const p = byPriority.get(name);
      next[name] = {
        firstResponseMinutes: p?.firstResponseMinutes ?? 0,
        resolutionMinutes: p?.resolutionMinutes ?? 0,
      };
    }
    setRows(next);
  }, [data]);

  const save = useMutation({
    mutationFn: (input: { priority: PriorityValue; row: Row }) =>
      slaPoliciesApi.save({
        priority: input.priority,
        firstResponseMinutes: input.row.firstResponseMinutes,
        resolutionMinutes: input.row.resolutionMinutes,
      }),
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['sla', 'policies'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const setField = (name: PriorityName, field: keyof Row, value: number) =>
    setRows((r) => ({ ...r, [name]: { ...r[name], [field]: Math.max(0, value) } }));

  const fmt = useMemo(() => (m: number) => {
    if (!m || m <= 0) return '—';
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return h > 0 ? `${h}h${mm ? ` ${mm}min` : ''}` : `${mm}min`;
  }, []);

  if (isLoading) return <LoadingState label={t('loading')} />;
  if (isError) return <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  return (
    <PageTransition className="flex h-full flex-col gap-lg overflow-auto p-lg">
      <header className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
          <Gauge className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </header>

      <BusinessHoursCard />

      <div className="grid gap-md">
        {PRIORITIES.map(({ name, value }) => {
          const row = rows[name] ?? { firstResponseMinutes: 0, resolutionMinutes: 0 };
          const pending = save.isPending && save.variables?.priority === value;
          return (
            <div key={name} className="rounded-xl border border-border bg-panel p-md">
              <div className="flex flex-wrap items-end gap-lg">
                <div className="min-w-[120px]">
                  <span className={cn('inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold', PRIORITY_ACCENT[name])}>
                    {tPriority(name)}
                  </span>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-dim">
                    <Clock className="h-3.5 w-3.5" /> {t('firstResponse')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.firstResponseMinutes}
                      onChange={(e) => setField(name, 'firstResponseMinutes', Number(e.target.value))}
                      className="h-9 w-28"
                    />
                    <span className="text-xs text-dim">{t('minutes')} · {fmt(row.firstResponseMinutes)}</span>
                  </div>
                </label>

                <label className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-medium text-dim">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('resolution')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={row.resolutionMinutes}
                      onChange={(e) => setField(name, 'resolutionMinutes', Number(e.target.value))}
                      className="h-9 w-28"
                    />
                    <span className="text-xs text-dim">{t('minutes')} · {fmt(row.resolutionMinutes)}</span>
                  </div>
                </label>

                <Button
                  className="ml-auto"
                  loading={pending}
                  disabled={row.resolutionMinutes <= 0}
                  onClick={() => save.mutate({ priority: value, row })}
                >
                  <Save className="h-4 w-4" /> {t('save')}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-dim">{t('hint')}</p>
    </PageTransition>
  );
}
