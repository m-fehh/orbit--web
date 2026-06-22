'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, KeyRound } from 'lucide-react';
import { rolesApi } from '@/shared/api/endpoints';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { useWindowStore } from '@/features/windows/window-store';
import { RoleForm } from './role-form';

function openRoleWindow(title: string) {
  useWindowStore.getState().open({
    id: 'role-new',
    title,
    icon: <KeyRound className="h-4 w-4" />,
    modal: true,
    content: <RoleForm windowId="role-new" />,
  });
}

/** Papéis (Roles): tabela com busca e cadastro. */
export function RolesView() {
  const t = useTranslations('admin.roles');
  const [term, setTerm] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });

  const items = useMemo(() => {
    const list = data ?? [];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q));
  }, [data, term]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <h1 className="text-base font-bold">{t('title')}</h1>
        <div className="relative ml-auto w-56 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('searchPlaceholder')} className="" />
        </div>
        <Can permission="role.create">
          <Button onClick={() => openRoleWindow(t('newRole'))}>
            <Plus className="h-4 w-4" /> {t('new')}
          </Button>
        </Can>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />
        ) : items.length === 0 ? (
          <EmptyState icon={KeyRound} message={t('empty')} />
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((r) => (
              <li key={r.id} className="card-surface flex items-center gap-sm p-md">
                <KeyRound className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
                </div>
                <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-dim">{r.key}</span>
                {r.isAdminRole && <span className="rounded bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">ADMIN</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
