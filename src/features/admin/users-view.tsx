'use client';

import { useMemo, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { usersApi, internalApi } from '@/shared/api/endpoints';
import type { UserResponse } from '@/shared/api/types';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
import { openUserWindow } from './user-actions';

type UserRow = UserResponse & { profileName: string };

export function UsersView() {
  const t = useTranslations('admin.users');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const gridLabels = useDataGridLabels();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', 'list', page, pageSize],
    queryFn: () => usersApi.list(page, pageSize),
  });

  const profiles = useQuery({ queryKey: ['profile-groups'], queryFn: () => internalApi.profileGroups.list() });
  const profileName = useCallback(
    (id: number | null) => profiles.data?.find((p) => p.id === id)?.name ?? '—',
    [profiles.data],
  );

  const rows: UserRow[] = useMemo(() => {
    const list = (data?.items ?? []).map((u) => ({
      ...u,
      profileName: profileName(u.profileId),
    }));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  }, [data, search, profileName]);

  const columns: ColumnDef<UserRow>[] = useMemo(() => [
    {
      field: 'name',
      header: t('name'),
      sortable: true,
      width: 200,
      render: (v) => <span className="font-medium">{v}</span>,
    },
    {
      field: 'email',
      header: t('email'),
      sortable: true,
      width: 260,
      render: (v) => <span className="text-muted">{v}</span>,
    },
    {
      field: 'role',
      header: t('role'),
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: 'Admin', value: 'Admin' },
        { label: 'Analyst', value: 'Analyst' },
        { label: 'Operator', value: 'Operator' },
        { label: 'Viewer', value: 'Viewer' },
      ],
      width: 120,
      render: (v) => (
        <span className="rounded-full border border-border px-2 py-0.5 text-xs">{v}</span>
      ),
    },
    {
      field: 'profileName',
      header: t('profileGroup'),
      sortable: true,
      width: 180,
      render: (v) => <span className="text-muted">{v}</span>,
    },
    {
      field: 'twoFactorEnabled',
      header: 'MFA',
      width: 70,
      align: 'center',
      render: (v) => v
        ? <span className="text-success" title="MFA enabled">●</span>
        : <span className="text-dim" title="MFA disabled">○</span>,
    },
  ], [t]);

  return (
    <PageTransition className="flex h-full flex-col">
      <DataGrid<UserRow>
        gridId="admin-users"
        columns={columns}
        data={rows}
        rowKey="id"
        totalCount={search ? rows.length : (data?.totalCount ?? 0)}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); }}
        onRowClick={(u) => openUserWindow(u)}
        onRefresh={() => refetch()}
        loading={isLoading}
        error={isError ? t('loadError') : null}
        emptyMessage={t('empty')}
        emptyIcon={Users}
        labels={gridLabels}
        toolbar={
          <Can permission="admin.users.create">
            <Button size="sm" onClick={() => openUserWindow()} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t('newUser')}
            </Button>
          </Can>
        }
      />
    </PageTransition>
  );
}
