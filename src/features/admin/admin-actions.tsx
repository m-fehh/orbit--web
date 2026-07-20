'use client';

import { Users, KeyRound, Users2 } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import type { TeamResponse, RoleResponse } from '@/shared/api/types';
import { UsersView } from './users-view';
import { RolesView } from './roles-view';
import { TeamsView } from './teams-view';
import { TeamForm } from './team-form';
import { RoleForm } from './role-form';

export function openUsersIndexWindow(title?: string) {
  useWindowStore.getState().open({
    id: 'users-index',
    title: title ?? 'Users',
    icon: <Users className="h-4 w-4" />,
    modal: true,
    content: <UsersView />,
  });
}

export function openRolesIndexWindow(title?: string) {
  useWindowStore.getState().open({
    id: 'roles-index',
    title: title ?? 'Roles',
    icon: <KeyRound className="h-4 w-4" />,
    modal: true,
    content: <RolesView />,
  });
}

export function openTeamsIndexWindow(title?: string) {
  useWindowStore.getState().open({
    id: 'teams-index',
    title: title ?? 'Teams',
    icon: <Users2 className="h-4 w-4" />,
    modal: true,
    content: <TeamsView />,
  });
}

/**
 * Abre o cadastro de papel como drawer (por cima do formulário atual). Ao criar, `onCreated`
 * devolve o papel para o chamador auto-selecionar e voltar ao formulário — o "+" do select2.
 */
export function openRoleFormWindow(title: string, onCreated?: (role: RoleResponse) => void) {
  const id = 'role-form-create';
  useWindowStore.getState().open({
    id,
    title,
    icon: <KeyRound className="h-4 w-4" />,
    modal: true,
    width: 420,
    content: <RoleForm windowId={id} onCreated={onCreated} />,
  });
}

/**
 * Abre o cadastro de equipe como drawer (por cima do formulário atual). Ao criar, `onCreated`
 * devolve a equipe para o chamador auto-selecionar e voltar ao formulário — o "+" do select2.
 */
export function openTeamFormWindow(title: string, onCreated?: (team: TeamResponse) => void) {
  const id = 'team-form-create';
  useWindowStore.getState().open({
    id,
    title,
    icon: <Users2 className="h-4 w-4" />,
    modal: true,
    width: 420,
    content: <TeamForm windowId={id} onCreated={onCreated} />,
  });
}
