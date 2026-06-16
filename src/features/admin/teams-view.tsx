'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Users } from 'lucide-react';
import { teamsApi } from '@/shared/api/endpoints';
import type { TeamResponse } from '@/shared/api/types';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState, EmptyState, ErrorState } from '@/shared/ui/states';
import { useWindowStore } from '@/features/windows/window-store';
import { TeamForm } from './team-form';

function openTeamWindow() {
  useWindowStore.getState().open({
    id: 'team-new',
    title: 'Nova equipe',
    icon: <Users className="h-4 w-4" />,
    modal: true,
    content: <TeamForm windowId="team-new" />,
  });
}

/** Equipes (Teams): tabela com busca e cadastro. */
export function TeamsView() {
  const [term, setTerm] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const items = useMemo(() => {
    const list = (data ?? []) as TeamResponse[];
    if (!term.trim()) return list;
    const q = term.toLowerCase();
    return list.filter((r) => r.name.toLowerCase().includes(q));
  }, [data, term]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <h1 className="text-base font-bold">Equipes</h1>
        <div className="relative ml-auto w-56 max-w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" aria-hidden />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Buscar equipe…" className="pl-9" />
        </div>
        <Can permission="admin.teams.create">
          <Button onClick={openTeamWindow}>
            <Plus className="h-4 w-4" /> Nova
          </Button>
        </Can>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState title="Erro ao carregar" onRetry={() => refetch()} retryLabel="Tentar de novo" />
        ) : items.length === 0 ? (
          <EmptyState icon={Users} message="Nenhuma equipe encontrada." />
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((r) => (
              <li key={r.id} className="card-surface flex items-center gap-sm p-md">
                <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
                </div>
                {r.inactive && <span className="rounded bg-panel-2 px-1.5 text-[10px] font-semibold text-dim">INATIVA</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
