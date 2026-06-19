'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Save } from 'lucide-react';
import { toast } from 'sonner';
import { internalApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type ProfileGroupResponse } from '@/shared/api/types';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { AccessRuleTree } from './access-rule-tree';

type Draft = { id: number | null; name: string; administrator: boolean; selected: Set<number> };
const emptyDraft = (): Draft => ({ id: null, name: '', administrator: false, selected: new Set() });

/** Tela de Grupos de Perfil (PBAC): lista + editor com árvore de regras de acesso. */
export function ProfileGroupsView() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);

  const groups = useQuery({ queryKey: ['profile-groups'], queryFn: () => internalApi.profileGroups.list() });
  const rules = useQuery({ queryKey: ['access-rules'], queryFn: () => internalApi.accessRules.list() });
  const totalRules = rules.data?.length ?? 0;

  function edit(g: ProfileGroupResponse) {
    setDraft({
      id: g.id,
      name: g.name,
      administrator: g.administrator,
      selected: new Set(g.accessRules.map((r) => r.id)),
    });
  }

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: draft.name.trim(),
        administrator: draft.administrator,
        accessRuleIds: [...draft.selected],
      };
      return draft.id
        ? internalApi.profileGroups.update(draft.id, body)
        : internalApi.profileGroups.create(body);
    },
    onSuccess: (saved) => {
      toast.success(draft.id ? 'Perfil atualizado' : 'Perfil criado');
      qc.invalidateQueries({ queryKey: ['profile-groups'] });
      edit(saved as ProfileGroupResponse);
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível salvar o perfil')),
  });

  return (
    <div className="flex h-full">
      {/* Lista */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
        <div className="flex items-center justify-between border-b border-border p-md">
          <h1 className="text-sm font-bold">Grupos de Perfil</h1>
          <Button size="sm" onClick={() => setDraft(emptyDraft())}>
            <Plus className="h-4 w-4" /> Novo
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-sm">
          {groups.isLoading ? (
            <LoadingState />
          ) : groups.isError ? (
            <ErrorState title="Erro ao carregar" onRetry={() => groups.refetch()} retryLabel="Tentar de novo" />
          ) : (groups.data?.length ?? 0) === 0 ? (
            <EmptyState icon={ShieldCheck} message="Nenhum grupo de perfil." />
          ) : (
            groups.data!.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => edit(g)}
                className={cn(
                  'flex w-full items-center gap-sm rounded-md px-md py-sm text-left text-sm transition-colors',
                  draft.id === g.id ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
                )}
              >
                <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
                <span className="flex-1 truncate">{g.name}</span>
                {g.administrator && <span className="rounded bg-warning/15 px-1.5 text-[10px] font-semibold text-warning">ADMIN</span>}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Editor */}
      <section className="flex min-w-0 flex-1 flex-col">
        {draft.id === null && !draft.name.trim() ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-dim/40" />
              <p className="mt-md text-sm text-muted">Selecione um perfil para editar ou crie um novo.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-md border-b border-border p-md">
              <Input
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="Nome do grupo de perfil"
                className="max-w-sm"
              />
              {draft.administrator && (
                <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-warning/10 px-2 py-1 text-xs font-medium text-warning">
                  <ShieldCheck className="h-3.5 w-3.5" /> Administrador
                </span>
              )}
              <div className="ml-auto flex items-center gap-sm">
                <span className="text-xs text-dim">
                  {draft.selected.size} de {totalRules} acessos
                </span>
                <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!draft.name.trim()}>
                  <Save className="h-4 w-4" /> Salvar
                </Button>
              </div>
            </div>

            {/* Filtros das regras de acesso */}
            {!draft.administrator && (
              <div className="flex flex-wrap items-center gap-sm border-b border-border px-md py-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filtrar acessos…"
                  className="h-8 max-w-xs"
                />
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={onlySelected}
                    onChange={(e) => setOnlySelected(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--orbit-color-primary)]"
                  />
                  Apenas concedidos
                </label>
                <span className="ml-auto inline-flex items-center gap-3 text-xs text-dim">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-success" /> Pode
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-border-strong" /> Não pode
                  </span>
                </span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto p-lg">
              {draft.administrator ? (
                <p className="rounded-md border border-warning/40 bg-warning/5 p-md text-sm text-warning">
                  Perfil de administrador: acesso total. Só um administrador pode conceder/remover este nível.
                </p>
              ) : rules.isLoading ? (
                <LoadingState />
              ) : rules.isError ? (
                <ErrorState title="Erro ao carregar regras" onRetry={() => rules.refetch()} retryLabel="Tentar de novo" />
              ) : (
                <AccessRuleTree
                  rules={rules.data ?? []}
                  selected={draft.selected}
                  onChange={(next) => setDraft((d) => ({ ...d, selected: next }))}
                  query={query}
                  onlySelected={onlySelected}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
