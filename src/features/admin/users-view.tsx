'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { usersApi, internalApi } from '@/shared/api/endpoints';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { openUserWindow } from './user-actions';

/** Tela de Usuários: lista paginada + criação/edição (com busca de perfil). */
export function UsersView() {
  const t = useTranslations('admin.users');
  const [page, setPage] = useState(1);
  const [term, setTerm] = useState('');
  const pageSize = 20;

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['users', 'list', page],
    queryFn: () => usersApi.list(page, pageSize),
  });
  const profiles = useQuery({ queryKey: ['profile-groups'], queryFn: () => internalApi.profileGroups.list() });
  const profileName = (id: number | null) => profiles.data?.find((p) => p.id === id)?.name ?? '—';

  const items = useMemo(() => {
    const list = data?.items ?? [];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [data, term]);

  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / pageSize)) : 1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">{data ? `${data.totalCount} ${t('title').toLowerCase()}` : '—'}</p>
        </div>
        <div className="relative ml-auto w-64 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('filterPlaceholder')} className="" />
        </div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} aria-label={t('refresh')}>
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} aria-hidden />
        </Button>
        <Can permission="admin.users.create">
          <Button onClick={() => openUserWindow()}>
            <Plus className="h-4 w-4" /> {t('newUser')}
          </Button>
        </Can>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState label={t('loading')} />
        ) : isError ? (
          <ErrorState title={t('loadError')} onRetry={() => refetch()} retryLabel={t('retry')} />
        ) : items.length === 0 ? (
          <EmptyState message={t('empty')} />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-bg-subtle/90 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-dim">
                <th className="px-md py-2 font-semibold">{t('name')}</th>
                <th className="px-md py-2 font-semibold">{t('email')}</th>
                <th className="px-md py-2 font-semibold">{t('role')}</th>
                <th className="px-md py-2 font-semibold">{t('profileGroup')}</th>
                <th className="px-md py-2 text-center font-semibold">MFA</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openUserWindow(u)}
                  className="cursor-pointer border-t border-border/60 transition-colors hover:bg-primary-soft/40"
                >
                  <td className="px-md py-2.5 font-medium">{u.name}</td>
                  <td className="px-md py-2.5 text-muted">{u.email}</td>
                  <td className="px-md py-2.5"><span className="rounded-full border border-border px-2 py-0.5 text-xs">{u.role}</span></td>
                  <td className="px-md py-2.5 text-muted">{profileName(u.profileId)}</td>
                  <td className="px-md py-2.5 text-center">
                    {u.twoFactorEnabled ? <span className="text-success">●</span> : <span className="text-dim">○</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-end gap-sm border-t border-border px-md py-2 text-sm">
          <span className="text-muted">{t('page', { page, totalPages })}</span>
          <Button variant="secondary" size="icon" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label={t('previous')}>
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label={t('next')}>
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}
    </div>
  );
}
