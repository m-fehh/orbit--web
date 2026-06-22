'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { teamsApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

export function TeamForm({ windowId }: { windowId: string }) {
  const t = useTranslations('teamForm');
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const save = useMutation({
    mutationFn: () => teamsApi.create({ name: name.trim(), description: description.trim() || null }),
    onSuccess: () => {
      toast.success(t('created'));
      qc.invalidateQueries({ queryKey: ['teams'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('createError'))),
  });

  const canSave = name.trim().length >= 2;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save.mutate();
      }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-md overflow-auto p-lg">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('name')}
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('namePh')} autoFocus />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('description')}
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPh')} />
        </label>
      </div>
      <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          {t('cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
