'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi, rolesApi, teamsApi, internalApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type UserResponse } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openRolesIndexWindow } from './admin-actions';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/** Formulário de criação/edição de usuário (dentro de uma janela). */
export function UserForm({ windowId, user }: { windowId: string; user?: UserResponse }) {
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const isEdit = !!user;

  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number | null>(null);
  const [teamId, setTeamId] = useState<number | null>(user?.teamId ?? null);
  const [profileId, setProfileId] = useState<number | null>(user?.profileId ?? null);

  const roles = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });
  const profiles = useQuery({ queryKey: ['profile-groups'], queryFn: () => internalApi.profileGroups.list() });

  const roleOptions: ComboOption[] = (roles.data ?? []).map((r) => ({ id: r.id, label: r.name, hint: r.key }));
  const teamOptions: ComboOption[] = (teams.data ?? []).map((t) => ({ id: t.id, label: t.name }));
  const profileOptions: ComboOption[] = (profiles.data ?? []).map((p) => ({
    id: p.id,
    label: p.name,
    hint: p.administrator ? 'admin' : undefined,
  }));

  const save = useMutation({
    mutationFn: () => {
      if (isEdit) {
        return usersApi.update(user!.id, { name, email, roleId: roleId ?? undefined, teamId, profileId });
      }
      return usersApi.create({ name, email, password, roleId: roleId!, teamId, profileId });
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Usuário atualizado' : 'Usuário criado');
      qc.invalidateQueries({ queryKey: ['users'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível salvar o usuário')),
  });

  const canSave = name.trim() && email.trim() && roleId && (isEdit || password.length >= 6);

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
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        E-mail
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {!isEdit && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Senha inicial
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 6 caracteres" />
        </label>
      )}

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Papel (role)
        <AsyncCombobox options={roleOptions} value={roleId} onChange={setRoleId} loading={roles.isLoading} placeholder="Selecionar papel" allowClear={false} onCreate={openRolesIndexWindow} createLabel="Gerenciar papéis" />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Grupo de perfil (PBAC)
        <AsyncCombobox options={profileOptions} value={profileId} onChange={setProfileId} loading={profiles.isLoading} placeholder="Buscar perfil…" />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        Equipe (opcional)
        <AsyncCombobox options={teamOptions} value={teamId} onChange={setTeamId} loading={teams.isLoading} placeholder="Selecionar equipe" />
      </div>

      <div className="mt-sm flex justify-end gap-sm">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          Cancelar
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          {isEdit ? 'Salvar' : 'Criar usuário'}
        </Button>
      </div>
    </form>
  );
}
