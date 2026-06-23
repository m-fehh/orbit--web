'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Copy } from 'lucide-react';
import { iterationsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type IterationResponse } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openIterationWindow } from './iteration-actions';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { DatePicker } from '@/shared/ui/date-picker';

export function IterationForm({ windowId, iteration }: { windowId: string; iteration?: IterationResponse }) {
  const t = useTranslations('iterations');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const isEdit = !!iteration;

  const statusOptions = [
    { value: 'Planning', label: t('planning') },
    { value: 'Active', label: t('active') },
    { value: 'Completed', label: t('completed') },
    { value: 'Cancelled', label: t('cancelled') },
  ];

  const [name, setName] = useState(iteration?.name ?? '');
  const [goal, setGoal] = useState(iteration?.goal ?? '');
  const [startDate, setStartDate] = useState<string | null>(iteration?.startDate?.slice(0, 10) ?? null);
  const [endDate, setEndDate] = useState<string | null>(iteration?.endDate?.slice(0, 10) ?? null);
  const [status, setStatus] = useState(iteration?.status ?? 'Planning');

  const save = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), goal: goal.trim() || null, startDate: startDate!, endDate: endDate! };
      if (isEdit) {
        return iterationsApi.update(iteration!.id, { ...body, status });
      }
      return iterationsApi.create(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? t('updated') : t('created'));
      qc.invalidateQueries({ queryKey: ['iterations'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, tc('errorBody'))),
  });

  function handleDuplicate() {
    closeWindow(windowId);
    openIterationWindow(undefined, {
      name: `${iteration!.name} (cópia)`,
      goal: iteration!.goal ?? '',
      startDate: iteration!.startDate,
      endDate: iteration!.endDate,
    });
  }

  const canSave = name.trim().length > 0 && startDate && endDate;

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (canSave) save.mutate(); }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>{t('name')} <span className="text-danger">*</span></span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('name')} autoFocus />
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>{t('goal')}</span>
          <textarea
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 resize-none transition-all"
            placeholder={t('goal')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('startDate')} <span className="text-danger">*</span></span>
            <DatePicker value={startDate} onChange={setStartDate} placeholder={t('startDate')} />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('endDate')} <span className="text-danger">*</span></span>
            <DatePicker value={endDate} onChange={setEndDate} placeholder={t('endDate')} />
          </div>
        </div>

        {isEdit && (
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('status')}</span>
            <Select<string> value={status} onChange={setStatus} options={statusOptions} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t border-border bg-panel p-4">
        {isEdit ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleDuplicate}>
            <Copy className="h-3.5 w-3.5" /> {t('duplicate')}
          </Button>
        ) : <span />}
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
            {tc('cancel')}
          </Button>
          <Button type="submit" loading={save.isPending} disabled={!canSave}>
            {tc('save')}
          </Button>
        </div>
      </div>
    </form>
  );
}
