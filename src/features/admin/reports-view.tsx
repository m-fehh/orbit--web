'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileBarChart, Download, Plus, Trash2, Play, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import { reportsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type SaveReportScheduleRequest } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/datetime';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Checkbox } from '@/shared/ui/checkbox';
import { LoadingState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';
import type { Locale } from '@/shared/i18n/config';

const DATASET = { Tickets: 1, Audit: 2 } as const;
const FORMAT = { Csv: 1, Pdf: 2, Xlsx: 3 } as const;
const FREQUENCY = { Daily: 1, Weekly: 2, Monthly: 3 } as const;

/** Ícone + cor por formato de arquivo (usado nas listas de agendamentos e gerados). */
function formatMeta(fmt: string) {
  if (fmt === 'Pdf') return { Icon: FileText, cls: 'bg-danger/10 text-danger' };
  if (fmt === 'Csv') return { Icon: FileType, cls: 'bg-sky-500/10 text-sky-500' };
  return { Icon: FileSpreadsheet, cls: 'bg-success/10 text-success' }; // Xlsx
}

/** Baixa um relatório gerado (blob autenticado → download com o nome do arquivo). */
async function downloadReport(id: number, fileName: string) {
  const blob = await reportsApi.downloadBlob(id);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  URL.revokeObjectURL(url);
}

export function ReportsView() {
  const t = useTranslations('reports');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();

  const schedules = useQuery({ queryKey: ['reports', 'schedules'], queryFn: () => reportsApi.schedules(), retry: false });
  const generated = useQuery({ queryKey: ['reports', 'list'], queryFn: () => reportsApi.list(), retry: false });

  // Form (criar agendamento / gerar agora compartilham dataset+format+janela).
  const [name, setName] = useState('');
  const [dataset, setDataset] = useState<number>(DATASET.Tickets);
  const [format, setFormat] = useState<number>(FORMAT.Xlsx);
  const [frequency, setFrequency] = useState<number>(FREQUENCY.Weekly);
  const [windowDays, setWindowDays] = useState('7');

  const run = useMutation({
    mutationFn: () => reportsApi.run({ dataset, format, windowDays: Number(windowDays) || 7 }),
    onSuccess: () => { toast.success(t('generated')); qc.invalidateQueries({ queryKey: ['reports', 'list'] }); },
    onError: (e) => toast.error(apiErrorMessage(e, t('error'))),
  });

  const save = useMutation({
    mutationFn: (body: SaveReportScheduleRequest) => reportsApi.saveSchedule(body),
    onSuccess: () => { toast.success(t('scheduleSaved')); setName(''); qc.invalidateQueries({ queryKey: ['reports', 'schedules'] }); },
    onError: (e) => toast.error(apiErrorMessage(e, t('error'))),
  });

  const del = useMutation({
    mutationFn: (id: number) => reportsApi.deleteSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reports', 'schedules'] }),
    onError: (e) => toast.error(apiErrorMessage(e, t('error'))),
  });

  const datasetOpts = [
    { value: DATASET.Tickets, label: t('dsTickets') },
    { value: DATASET.Audit, label: t('dsAudit') },
  ];
  const formatOpts = [
    { value: FORMAT.Xlsx, label: 'Excel (XLSX)' },
    { value: FORMAT.Csv, label: 'CSV' },
    { value: FORMAT.Pdf, label: 'PDF' },
  ];
  const freqOpts = [
    { value: FREQUENCY.Daily, label: t('freqDaily') },
    { value: FREQUENCY.Weekly, label: t('freqWeekly') },
    { value: FREQUENCY.Monthly, label: t('freqMonthly') },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-lg overflow-auto p-lg">
        <header className="flex flex-wrap items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
            <FileBarChart className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-text">{t('title')}</h1>
            <p className="text-sm text-muted">{t('subtitle')}</p>
          </div>
        </header>

        {/* Configuração compartilhada + ações */}
        <div className="card-surface flex flex-col gap-4 p-lg">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('dataset')}</span>
              <Select<number> value={dataset} onChange={setDataset} options={datasetOpts} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('format')}</span>
              <Select<number> value={format} onChange={setFormat} options={formatOpts} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('windowDays')}</span>
              <Input type="number" min={1} value={windowDays} onChange={(e) => setWindowDays(e.target.value)} className="h-9 w-24" />
            </label>
            <Button variant="secondary" loading={run.isPending} onClick={() => run.mutate()}>
              <Play className="h-4 w-4" /> {t('runNow')}
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 border-t border-border pt-4">
            <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('scheduleName')}</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('scheduleNamePh')} className="h-9" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('frequency')}</span>
              <Select<number> value={frequency} onChange={setFrequency} options={freqOpts} />
            </label>
            <Button
              loading={save.isPending}
              disabled={name.trim() === ''}
              onClick={() => save.mutate({ id: null, name: name.trim(), dataset, format, frequency, windowDays: Number(windowDays) || 7, active: true })}
            >
              <Plus className="h-4 w-4" /> {t('schedule')}
            </Button>
          </div>
        </div>

        {/* Agendamentos */}
        <section className="card-surface overflow-hidden">
          <h2 className="border-b border-border px-lg py-3 text-sm font-bold text-text">{t('schedules')}</h2>
          {schedules.isLoading ? <LoadingState /> : (schedules.data ?? []).length === 0 ? (
            <p className="px-lg py-6 text-center text-xs text-dim">{t('noSchedules')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {(schedules.data ?? []).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-lg py-2.5">
                  {(() => { const m = formatMeta(s.format); return (
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', m.cls)}>
                    <m.Icon className="h-3.5 w-3.5" />
                  </span>); })()}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{s.name}</p>
                    <p className="text-[11px] text-dim">
                      {t(`ds${s.dataset}` as 'dsTickets')} · {t(`freq${s.frequency}` as 'freqWeekly')} · {t('windowShort', { days: s.windowDays })}
                      {s.lastRunAt ? ` · ${t('lastRun')} ${formatDateTime(s.lastRunAt, { locale, timeZone })}` : ''}
                    </p>
                  </div>
                  {!s.active && <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[9px] font-bold uppercase text-dim">{t('inactive')}</span>}
                  <button type="button" onClick={() => del.mutate(s.id)} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-dim hover:bg-danger/10 hover:text-danger" aria-label={t('delete')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Relatórios gerados */}
        <section className="card-surface overflow-hidden">
          <h2 className="border-b border-border px-lg py-3 text-sm font-bold text-text">{t('generatedTitle')}</h2>
          {generated.isLoading ? <LoadingState /> : (generated.data ?? []).length === 0 ? (
            <p className="px-lg py-6 text-center text-xs text-dim">{t('noGenerated')}</p>
          ) : (
            <ul className="divide-y divide-border/60">
              {(generated.data ?? []).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-lg py-2.5">
                  {(() => { const m = formatMeta(r.format); return (
                  <span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', m.cls)}>
                    <m.Icon className="h-3.5 w-3.5" />
                  </span>); })()}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-text">{r.fileName}</p>
                    <p className="text-[11px] text-dim">{t('rows', { count: r.rowCount })} · {formatDateTime(r.generatedAt, { locale, timeZone })}</p>
                  </div>
                  <button type="button" onClick={() => downloadReport(r.id, r.fileName)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs text-muted hover:bg-panel-2 hover:text-text">
                    <Download className="h-3.5 w-3.5" /> {t('download')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
