'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { rolesApi } from '@/shared/api/endpoints';
import { apiErrorMessage } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/** Cria um novo papel (Role) — tabela, não enum. A "key" é o identificador único. */
export function RoleForm({ windowId }: { windowId: string }) {
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
      toast.success('Papel criado');
      qc.invalidateQueries({ queryKey: ['roles'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível criar o papel')),
  });

  const canSave = name.trim() && /^[a-z0-9-]{2,}$/.test(key.trim());

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSave) save.mutate();
      }}
      className="flex flex-col gap-md p-lg"
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Nome
        <Input value={name} onChange={(e) => onName(e.target.value)} placeholder="Ex.: Analista N2" autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Chave (key)
        <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="analista-n2" className="font-mono" />
        <span className="text-xs text-dim">Identificador único, minúsculas e hífens.</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descrição (opcional)
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Para que serve este papel" />
      </label>
      <div className="mt-sm flex justify-end gap-sm">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          Criar papel
        </Button>
      </div>
    </form>
  );
}
