'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Gauge, Save, CalendarClock } from 'lucide-react';
import { slaPoliciesApi, businessHoursApi } from '@/shared/api/endpoints';
import {
  Priority, apiErrorMessage,
  type PriorityName, type PriorityValue, type SlaPolicyResponse, type BusinessHoursResponse, type BusinessHoursDay,
} from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Checkbox } from '@/shared/ui/checkbox';
import { Modal } from '@/shared/ui/modal';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition, LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmtDuration = (m: number) => {
  if (!m || m <= 0) return '—';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}h${mm ? ` ${mm}min` : ''}` : `${mm}min`;
};

/** Fusos comuns (foco Brasil + alguns internacionais). O fuso salvo é sempre incluído. */
const COMMON_TIME_ZONES: { id: string; label: string }[] = [
  { id: 'America/Sao_Paulo', label: 'Brasília (GMT-3)' },
  { id: 'America/Manaus', label: 'Manaus (GMT-4)' },
  { id: 'America/Cuiaba', label: 'Cuiabá (GMT-4)' },
  { id: 'America/Campo_Grande', label: 'Campo Grande (GMT-4)' },
  { id: 'America/Rio_Branco', label: 'Rio Branco (GMT-5)' },
  { id: 'America/Belem', label: 'Belém (GMT-3)' },
  { id: 'America/Fortaleza', label: 'Fortaleza (GMT-3)' },
  { id: 'America/Recife', label: 'Recife (GMT-3)' },
  { id: 'America/Bahia', label: 'Salvador (GMT-3)' },
  { id: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
  { id: 'UTC', label: 'UTC (GMT+0)' },
  { id: 'America/New_York', label: 'New York (GMT-5/-4)' },
  { id: 'America/Chicago', label: 'Chicago (GMT-6/-5)' },
  { id: 'America/Los_Angeles', label: 'Los Angeles (GMT-8/-7)' },
  { id: 'Europe/Lisbon', label: 'Lisboa (GMT+0/+1)' },
  { id: 'Europe/London', label: 'Londres (GMT+0/+1)' },
  { id: 'Europe/Madrid', label: 'Madri (GMT+1/+2)' },
];

/**
 * Normaliza a resposta do expediente para o formato por dia. Tolera backends antigos que ainda
 * devolvem apenas os campos legados (workDays/startMinute/endMinute) sem `days`, derivando as
 * 7 janelas a partir deles — evita quebrar a tela antes da migração/rebuild do backend.
 */
function normalizeBusinessHours(data: BusinessHoursResponse): BusinessHoursResponse {
  if (Array.isArray(data.days) && data.days.length > 0) return data;

  const legacy = data as unknown as { workDays?: string; startMinute?: number; endMinute?: number };
  const workDays = new Set(
    (legacy.workDays ?? '1,2,3,4,5').split(',').map((d) => Number(d.trim())).filter(Boolean),
  );
  const start = legacy.startMinute ?? 540;
  const end = legacy.endMinute ?? 1080;
  const days: BusinessHoursDay[] = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    return { day, enabled: workDays.has(day), startMinute: start, endMinute: end };
  });
  return { enabled: data.enabled, timeZoneId: data.timeZoneId || 'America/Sao_Paulo', days };
}

/** Expediente do tenant — quando ativo, o SLA conta só em horário útil (por dia). */
function BusinessHoursCard() {
  const t = useTranslations('slaSettings');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['business-hours'], queryFn: () => businessHoursApi.get() });

  const [form, setForm] = useState<BusinessHoursResponse | null>(null);
  useEffect(() => { if (data) setForm(normalizeBusinessHours(data)); }, [data]);

  const dayLabel = (iso: number) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, iso)));

  const save = useMutation({
    mutationFn: (body: BusinessHoursResponse) => businessHoursApi.save(body),
    onSuccess: () => { toast.success(t('hoursSaved')); qc.invalidateQueries({ queryKey: ['business-hours'] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  if (!form) return null;

  const days = [...form.days].sort((a, b) => a.day - b.day);
  const patchDay = (iso: number, patch: Partial<BusinessHoursDay>) =>
    setForm({ ...form, days: form.days.map((d) => (d.day === iso ? { ...d, ...patch } : d)) });

  const tzOptions = COMMON_TIME_ZONES.some((z) => z.id === form.timeZoneId)
    ? COMMON_TIME_ZONES
    : [{ id: form.timeZoneId, label: form.timeZoneId }, ...COMMON_TIME_ZONES];

  return (
    <div className="card-surface overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-gradient-to-r from-info/8 to-transparent px-lg py-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-info/10 text-info">
          <CalendarClock className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-bold text-text">{t('businessHours')}</h2>
          <p className="text-xs text-muted">{t('businessHoursHint')}</p>
        </div>
        <Checkbox checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })} label={t('enabled')} />
      </div>

      {form.enabled && (
        <div className="flex flex-col gap-4 p-lg">
          {/* Fuso horário — obrigatório para o expediente fazer sentido */}
          <label className="flex max-w-md flex-col gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('timeZone')}</span>
            <select
              value={form.timeZoneId}
              onChange={(e) => setForm({ ...form, timeZoneId: e.target.value })}
              className="h-9 rounded-lg border border-border bg-bg-subtle px-2.5 text-sm text-text outline-none focus:border-primary"
            >
              {tzOptions.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </select>
            <span className="text-[11px] text-dim">{t('timeZoneHint')}</span>
          </label>

          {/* Dias da semana como TABELA — cada dia com seu próprio horário */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border bg-panel-2/50 text-[10px] font-semibold uppercase tracking-wider text-dim">
                  <th className="px-4 py-2 text-left">{t('day')}</th>
                  <th className="px-4 py-2 text-left">{t('situation')}</th>
                  <th className="px-4 py-2 text-left">{t('start')}</th>
                  <th className="px-4 py-2 text-left">{t('end')}</th>
                  <th className="px-4 py-2 text-right">{t('active')}</th>
                </tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const on = d.enabled;
                  return (
                    <tr key={d.day} className="border-b border-border/50 last:border-0 hover:bg-panel-2/30">
                      <td className="px-4 py-2.5 font-medium capitalize text-text">{dayLabel(d.day)}</td>
                      <td className="px-4 py-2.5">
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', on ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim')}>
                          {on ? t('workDay') : t('dayOff')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="time"
                          aria-label={`${dayLabel(d.day)} — ${t('start')}`}
                          value={toHHMM(d.startMinute)}
                          disabled={!on}
                          onChange={(e) => patchDay(d.day, { startMinute: fromHHMM(e.target.value) })}
                          className="h-8 w-28"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Input
                          type="time"
                          aria-label={`${dayLabel(d.day)} — ${t('end')}`}
                          value={toHHMM(d.endMinute)}
                          disabled={!on}
                          onChange={(e) => patchDay(d.day, { endMinute: fromHHMM(e.target.value) })}
                          className="h-8 w-28"
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button type="button" role="switch" aria-checked={on} aria-label={dayLabel(d.day)} onClick={() => patchDay(d.day, { enabled: !on })} className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', on ? 'bg-success' : 'bg-border-strong')}>
                          <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', on ? 'translate-x-4' : 'translate-x-0.5')} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end border-t border-border px-lg py-3">
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
  Critical: 'text-danger bg-danger/10 ring-danger/30',
  High: 'text-warning bg-warning/10 ring-warning/30',
  Medium: 'text-info bg-info/10 ring-info/30',
  Low: 'text-muted bg-panel-2 ring-border',
};

type GridRow = {
  priority: PriorityName;
  priorityValue: PriorityValue;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  configured: boolean;
};

/** Modal de edição da meta de SLA de uma prioridade (entradas em horas). */
function SlaEditModal({ row, onClose }: { row: GridRow; onClose: () => void }) {
  const t = useTranslations('slaSettings');
  const tPriority = useTranslations('priority');
  const qc = useQueryClient();
  const [fr, setFr] = useState<string>(row.firstResponseMinutes ? String(row.firstResponseMinutes / 60) : '');
  const [res, setRes] = useState<string>(row.resolutionMinutes ? String(row.resolutionMinutes / 60) : '');

  const save = useMutation({
    mutationFn: () => slaPoliciesApi.save({
      priority: row.priorityValue,
      firstResponseMinutes: fr === '' ? 0 : Math.round(Number(fr) * 60),
      resolutionMinutes: res === '' ? 0 : Math.round(Number(res) * 60),
    }),
    onSuccess: () => {
      toast.success(t('saved'));
      qc.invalidateQueries({ queryKey: ['sla', 'policies'] });
      onClose();
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t('editTitle', { priority: tPriority(row.priority) })}
      subtitle={t('editSubtitle')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('cancel')}</Button>
          <Button loading={save.isPending} disabled={res.trim() === ''} onClick={() => save.mutate()}>
            <Save className="h-4 w-4" /> {t('save')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">{t('firstResponse')}</span>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={0.5} value={fr} onChange={(e) => setFr(e.target.value)} placeholder="0" className="h-9" autoFocus />
            <span className="text-xs text-dim">h</span>
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">{t('resolution')} <span className="text-danger">*</span></span>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={0.5} value={res} onChange={(e) => setRes(e.target.value)} placeholder={t('estimateRequired')} className="h-9" />
            <span className="text-xs text-dim">h</span>
          </div>
        </label>
      </div>
    </Modal>
  );
}

export function SlaPoliciesView() {
  const t = useTranslations('slaSettings');
  const tPriority = useTranslations('priority');
  const gridLabels = useDataGridLabels();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['sla', 'policies'],
    queryFn: () => slaPoliciesApi.list(),
  });

  const [editing, setEditing] = useState<GridRow | null>(null);

  const rows = useMemo<GridRow[]>(() => {
    const byPriority = new Map<string, SlaPolicyResponse>((data ?? []).map((p) => [p.priority, p] as const));
    return PRIORITIES.map(({ name, value }) => {
      const p = byPriority.get(name);
      return {
        priority: name,
        priorityValue: value,
        firstResponseMinutes: p?.firstResponseMinutes ?? 0,
        resolutionMinutes: p?.resolutionMinutes ?? 0,
        configured: (p?.resolutionMinutes ?? 0) > 0,
      };
    });
  }, [data]);

  const columns: ColumnDef<GridRow>[] = useMemo(() => [
    {
      field: 'priority',
      header: t('priority'),
      width: 180,
      render: (v: PriorityName) => (
        <span className={cn('inline-flex rounded-md px-2.5 py-1 text-xs font-semibold ring-1', PRIORITY_ACCENT[v])}>
          {tPriority(v)}
        </span>
      ),
    },
    {
      field: 'firstResponseMinutes',
      header: t('firstResponse'),
      align: 'center',
      render: (v: number) => <span className={cn('tabular-nums', v > 0 ? 'text-text' : 'text-dim')}>{fmtDuration(v)}</span>,
    },
    {
      field: 'resolutionMinutes',
      header: t('resolution'),
      align: 'center',
      render: (v: number) => <span className={cn('font-medium tabular-nums', v > 0 ? 'text-text' : 'text-dim')}>{fmtDuration(v)}</span>,
    },
    {
      field: 'configured',
      header: t('statusHeader'),
      width: 130,
      align: 'center',
      render: (v: boolean) => v
        ? <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">{t('configured')}</span>
        : <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-bold text-dim">{t('pending')}</span>,
    },
  ], [t, tPriority]);

  if (isLoading) return <LoadingState label={t('loading')} />;
  if (isError) return <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  return (
    <PageTransition className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-auto p-lg">
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
          <Gauge className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </header>

      <div data-tour="sla-targets">
        <DataGrid<GridRow>
          gridId="admin-sla"
          columns={columns}
          data={rows}
          rowKey="priority"
          totalCount={rows.length}
          onRefresh={() => refetch()}
          loading={isLoading}
          emptyMessage={t('empty')}
          emptyIcon={Gauge}
          labels={gridLabels}
          onRowClick={(row) => setEditing(row)}
        />
      </div>
      <p className="text-xs text-dim">{t('hint')}</p>

      <BusinessHoursCard />
      </div>

      {editing && <SlaEditModal row={editing} onClose={() => setEditing(null)} />}
    </PageTransition>
  );
}
