'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { Plus, KeyRound } from 'lucide-react';
import { rolesApi } from '@/shared/api/endpoints';
import type { RoleResponse } from '@/shared/api/types';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
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

export function RolesView() {
  const t = useTranslations('admin.roles');
  const gridLabels = useDataGridLabels();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['roles'], queryFn: () => rolesApi.list() });

  const items = data ?? [];

  const columns: ColumnDef<RoleResponse>[] = useMemo(() => [
    {
      field: 'name',
      header: t('name'),
      sortable: true,
      filterable: true,
      filterType: 'text',
      width: 220,
      render: (v) => (
        <span className="flex items-center gap-sm">
          <KeyRound className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium">{v}</span>
        </span>
      ),
    },
    {
      field: 'key',
      header: t('key'),
      sortable: true,
      width: 180,
      render: (v) => <span className="rounded bg-panel-2 px-1.5 py-0.5 font-mono text-xs text-dim">{v}</span>,
    },
    {
      field: 'description',
      header: t('description'),
      sortable: true,
      width: 350,
      render: (v) => <span className="text-muted">{v ?? '—'}</span>,
    },
    {
      field: 'isAdminRole',
      header: 'Admin',
      width: 80,
      align: 'center',
      render: (v) => v
        ? <span className="rounded bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">ADMIN</span>
        : null,
    },
    {
      field: 'inactive',
      header: t('status'),
      width: 90,
      align: 'center',
      render: (v) => v
        ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">{t('inactive')}</span>
        : <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">{t('active')}</span>,
    },
  ], [t]);

  return (
    <PageTransition className="flex h-full flex-col gap-lg p-lg">
      <DataGrid<RoleResponse>
        gridId="admin-roles"
        columns={columns}
        data={items}
        rowKey="id"
        totalCount={items.length}
        onRefresh={() => refetch()}
        loading={isLoading}
        error={isError ? t('loadError') : null}
        emptyMessage={t('empty')}
        emptyIcon={KeyRound}
        labels={gridLabels}
        toolbar={
          <Can permission="role.create">
            <Button size="sm" onClick={() => openRoleWindow(t('newRole'))} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t('new')}
            </Button>
          </Can>
        }
      />
    </PageTransition>
  );
}
