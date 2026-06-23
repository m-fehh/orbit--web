'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { teamsApi } from '@/shared/api/endpoints';
import type { TeamResponse } from '@/shared/api/types';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { DataGrid, type ColumnDef, useDataGridLabels } from '@/shared/ui/data-grid';
import { PageTransition } from '@/shared/ui/states';
import { useWindowStore } from '@/features/windows/window-store';
import { TeamForm } from './team-form';

function openTeamWindow(title: string) {
  useWindowStore.getState().open({
    id: 'team-new',
    title,
    icon: <Users className="h-4 w-4" />,
    modal: true,
    content: <TeamForm windowId="team-new" />,
  });
}

export function TeamsView() {
  const t = useTranslations('admin.teams');
  const gridLabels = useDataGridLabels();
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const items = (data ?? []) as TeamResponse[];

  const columns: ColumnDef<TeamResponse>[] = useMemo(() => [
    {
      field: 'name',
      header: t('name'),
      sortable: true,
      filterable: true,
      filterType: 'text',
      width: 260,
      render: (v) => (
        <span className="flex items-center gap-sm">
          <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium">{v}</span>
        </span>
      ),
    },
    {
      field: 'description',
      header: t('description'),
      sortable: true,
      width: 400,
      render: (v) => <span className="text-muted">{v ?? '—'}</span>,
    },
    {
      field: 'inactive',
      header: t('status'),
      width: 100,
      align: 'center',
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { label: t('active'), value: 'false' },
        { label: t('inactive'), value: 'true' },
      ],
      render: (v) => v
        ? <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">{t('inactive')}</span>
        : <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">{t('active')}</span>,
    },
  ], [t]);

  return (
    <PageTransition className="flex h-full flex-col gap-lg p-lg">
      <DataGrid<TeamResponse>
        gridId="admin-teams"
        columns={columns}
        data={items}
        rowKey="id"
        totalCount={items.length}
        onRefresh={() => refetch()}
        loading={isLoading}
        error={isError ? t('loadError') : null}
        emptyMessage={t('empty')}
        emptyIcon={Users}
        labels={gridLabels}
        toolbar={
          <Can permission="admin.teams.create">
            <Button size="sm" onClick={() => openTeamWindow(t('newTeam'))} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> {t('new')}
            </Button>
          </Can>
        }
      />
    </PageTransition>
  );
}
