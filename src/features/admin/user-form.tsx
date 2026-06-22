'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { usersApi, rolesApi, teamsApi, internalApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type UserResponse } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openRolesIndexWindow, openTeamsIndexWindow } from './admin-actions';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

/** Formulário de criação/edição de usuário (dentro de uma janela). */
export function UserForm({ windowId, user }: { windowId: string; user?: UserResponse }) {
  const t = useTranslations('admin.users');
  const tc = useTranslations('common');
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
      toast.success(isEdit ? t('userUpdated') : t('userCreated'));
      qc.invalidateQueries({ queryKey: ['users'] });
      closeWindow(windowId);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const canSave = name.trim() && email.trim() && roleId && (isEdit || password.length >= 6);

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
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t('email')}
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      {!isEdit && (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {t('initialPassword')}
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t('passwordHint')} />
        </label>
      )}

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        {t('role')}
        <AsyncCombobox options={roleOptions} value={roleId} onChange={setRoleId} loading={roles.isLoading} placeholder={t('selectRole')} allowClear={false} onCreate={openRolesIndexWindow} createLabel={t('manageRoles')} />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        {t('profileGroup')}
        <AsyncCombobox options={profileOptions} value={profileId} onChange={setProfileId} loading={profiles.isLoading} placeholder={t('searchProfile')} />
      </div>

      <div className="flex flex-col gap-1.5 text-sm font-medium">
        {t('teamOptional')}
        <AsyncCombobox options={teamOptions} value={teamId} onChange={setTeamId} loading={teams.isLoading} placeholder={t('selectTeam')} onCreate={openTeamsIndexWindow} createLabel={t('manageTeams')} />
      </div>

      </div>
      <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          {tc('cancel')}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!canSave}>
          {t('saveUser')}
        </Button>
      </div>
    </form>
  );
}
