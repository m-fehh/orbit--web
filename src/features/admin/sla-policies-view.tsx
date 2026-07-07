'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Gauge, Save, CalendarClock } from 'lucide-react';
import { slaPoliciesApi, businessHoursApi } from '@/shared/api/endpoints';
import {
  Priority, apiErrorMessage,
  type PriorityName, type PriorityValue, type SlaPolicyResponse, type BusinessHoursResponse,
} from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Checkbox } from '@/shared/ui/checkbox';
import { Modal } from '@/shared/ui/modal';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition, LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7];
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const fromHHMM = (v: string) => { const [h, m] = v.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const fmtDuration = (m: number) => {
  if (!m || m <= 0) return '—';
  const h = Math.floor(m / 60), mm = m % 60;
  return h > 0 ? `${h}h${mm ? ` ${mm}min` : ''}` : `${mm}min`;
};

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
        <div className="flex flex-col gap-5 p-lg">
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-dim">{t('workDays')}</span>
            <div className="flex flex-wrap gap-1.5">
              {ISO_DAYS.map((iso) => (
                <button
                  key={iso}
                  type="button"
                  onClick={() => toggleDay(iso)}
                  className={cn(
                    'grid h-9 min-w-[44px] place-items-center rounded-full border px-3 text-xs font-semibold capitalize transition-colors',
                    activeDays.has(iso) ? 'border-info bg-info/10 text-info' : 'border-border text-dim hover:border-info/40 hover:text-text',
                  )}
                >
                  {dayLabel(iso)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-dim">{t('start')} → {t('end')}</span>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-panel-2/40 px-3 py-2">
              <CalendarClock className="h-4 w-4 shrink-0 text-info" />
              <Input type="time" aria-label={t('start')} value={toHHMM(form.startMinute)} onChange={(e) => setForm({ ...form, startMinute: fromHHMM(e.target.value) })} className="h-8 w-28" />
              <span className="text-dim">→</span>
              <Input type="time" aria-label={t('end')} value={toHHMM(form.endMinute)} onChange={(e) => setForm({ ...form, endMinute: fromHHMM(e.target.value) })} className="h-8 w-28" />
            </div>
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
    <PageTransition className="flex h-full flex-col gap-lg overflow-auto p-lg">
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

      {editing && <SlaEditModal row={editing} onClose={() => setEditing(null)} />}
    </PageTransition>
  );
}
