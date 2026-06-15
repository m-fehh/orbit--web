'use client';

import { UserPlus, UserCog } from 'lucide-react';
import { useWindowStore } from '@/features/windows/window-store';
import type { UserResponse } from '@/shared/api/types';
import { UserForm } from './user-form';

/** Abre a janela modal de criação/edição de usuário. */
export function openUserWindow(user?: UserResponse) {
  const id = user ? `user-${user.id}` : 'user-new';
  useWindowStore.getState().open({
    id,
    title: user ? user.name : 'Novo usuário',
    icon: user ? <UserCog className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />,
    modal: true,
    width: 540,
    height: 600,
    content: <UserForm windowId={id} user={user} />,
  });
}
