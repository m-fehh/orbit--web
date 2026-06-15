'use client';

import { Users, KeyRound } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import { UsersView } from './users-view';
import { RolesView } from './roles-view';

/** Abre a listagem de usuários (index + botão de cadastrar) num drawer, para navegação rápida. */
export function openUsersIndexWindow() {
  useWindowStore.getState().open({
    id: 'users-index',
    title: 'Usuários',
    icon: <Users className="h-4 w-4" />,
    modal: true,
    content: <UsersView />,
  });
}

/** Abre a listagem de papéis (Roles) — tabela com busca e cadastro — num drawer. */
export function openRolesIndexWindow() {
  useWindowStore.getState().open({
    id: 'roles-index',
    title: 'Papéis',
    icon: <KeyRound className="h-4 w-4" />,
    modal: true,
    content: <RolesView />,
  });
}
