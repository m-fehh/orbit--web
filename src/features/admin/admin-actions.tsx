'use client';

import { Users, KeyRound, Users2 } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import { UsersView } from './users-view';
import { RolesView } from './roles-view';
import { TeamsView } from './teams-view';

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
