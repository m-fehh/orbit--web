'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { teamsApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/** Cadastro de equipe (Team). Espelha o cadastro de Papel (Role). */
export function TeamForm({ windowId }: { windowId: string }) {
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const save = useMutation({
    mutationFn: () => teamsApi.create({ name: name.trim(), description: description.trim() || null }),
    onSuccess: () => {
      toast.success('Equipe criada');
      qc.invalidateQueries({ queryKey: ['teams'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível criar a equipe')),
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
          Nome
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Suporte N2" autoFocus />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Descrição (opcional)
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve esta equipe" />
        </label>
      </div>
      <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          Criar equipe
        </Button>
      </div>
    </form>
  );
}
