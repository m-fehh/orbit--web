'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rolesApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/** Cria um novo papel (Role) — tabela, não enum. A "key" é o identificador único. */
export function RoleForm({ windowId }: { windowId: string }) {
  const t = useTranslations('admin.roles');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');

  // Sugere a key a partir do nome (slug), mas o usuário pode editar.
  function onName(v: string) {
    const prevSuggested = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    setName(v);
    if (key === '' || key === prevSuggested) {
      setKey(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
    }
  }

  const save = useMutation({
    mutationFn: () => rolesApi.create({ name: name.trim(), key: key.trim(), description: description.trim() || null }),
    onSuccess: () => {
      toast.success(t('created'));
      qc.invalidateQueries({ queryKey: ['roles'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('createError'))),
  });

  const canSave = name.trim() && /^[a-z0-9-]{2,}$/.test(key.trim());

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
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder={t('namePlaceholder')} autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t('key')}
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('keyPlaceholder')} className="font-mono" />
        <span className="text-xs text-dim">{t('keyHint')}</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t('descriptionOptional')}
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPlaceholder')} />
      </label>
      </div>
      <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          {tc('cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          {t('createRole')}
        </Button>
      </div>
    </form>
  );
}
