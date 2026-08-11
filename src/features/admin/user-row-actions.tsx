'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Power, UserX } from 'lucide-react';
import { usersApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type UserResponse } from '@/shared/api/types';
import { usePermissions } from '@/features/auth/use-permissions';
import { useConfirm } from '@/shared/ui/confirm-dialog';
import { cn } from '@/shared/lib/utils';

/**
 * Ações por linha na grid de usuários — capacidades que a API já expunha e a UI não usava:
 * Ativar/Desativar e **Anonimizar (LGPD, irreversível)**. Cada ação é gated pela permissão
 * correspondente; sem nenhuma, não renderiza. `stopPropagation` para não abrir a edição da linha.
 */
export function UserRowActions({ user }: { user: UserResponse }) {
  const t = useTranslations('admin.users');
  const { can } = usePermissions();
  const qc = useQueryClient();
  const { confirm, node } = useConfirm();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const toggle = useMutation({
    mutationFn: () => (user.inactive ? usersApi.activate(user.id) : usersApi.deactivate(user.id)),
    onSuccess: () => { invalidate(); toast.success(user.inactive ? t('activated') : t('deactivated')); },
    onError: (e) => toast.error(apiErrorMessage(e, t('actionError'))),
  });

  const anonymize = useMutation({
    mutationFn: () => usersApi.anonymize(user.id),
    onSuccess: () => { invalidate(); toast.success(t('anonymized')); },
    onError: (e) => toast.error(apiErrorMessage(e, t('actionError'))),
  });

  const canToggle = can(user.inactive ? 'admin.users.activate' : 'admin.users.deactivate');
  const canAnon = can('admin.users.anonymize');
  if (!canToggle && !canAnon) return null;

  async function onAnonymize() {
    const ok = await confirm({
      title: t('anonymizeTitle'),
      message: t('anonymizeConfirm', { name: user.name }),
      confirmLabel: t('anonymize'),
      danger: true,
    });
    if (ok) anonymize.mutate();
  }

  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {canToggle && (
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          title={user.inactive ? t('activate') : t('deactivate')}
          aria-label={user.inactive ? t('activate') : t('deactivate')}
          className={cn(
            'grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-panel-2 disabled:opacity-50',
            user.inactive ? 'hover:text-success' : 'hover:text-warning',
          )}
        >
          <Power className="h-4 w-4" aria-hidden />
        </button>
      )}
      {canAnon && (
        <button
          type="button"
          onClick={onAnonymize}
          disabled={anonymize.isPending}
          title={t('anonymize')}
          aria-label={t('anonymize')}
          className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <UserX className="h-4 w-4" aria-hidden />
        </button>
      )}
      {node}
    </div>
  );
}
