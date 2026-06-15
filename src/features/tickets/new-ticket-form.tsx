'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sparkles, Lightbulb, ArrowRight, Loader2 } from 'lucide-react';
import { ticketsApi, usersApi } from '@/shared/api/endpoints';
import { Priority, apiErrorMessage, type PriorityValue, type TicketCreatedResponse } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { openTicketTab } from '@/features/tickets/ticket-actions';
import { openUsersIndexWindow } from '@/features/admin/admin-actions';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const fieldClass =
  'w-full rounded-md border border-border bg-bg-subtle px-md py-2 text-sm text-text outline-none focus:border-primary';

/** Criação de ticket (helpdesk) com pickers e análise inteligente pós-criação. */
export function NewTicketForm({ windowId }: { windowId: string }) {
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityValue>(Priority.Medium);
  const [requesterId, setRequesterId] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TicketCreatedResponse | null>(null);

  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 100) });
  const userOptions: ComboOption[] = (users.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));
  // Equipe herdada automaticamente do responsável.
  const assigneeTeamId = assigneeId ? users.data?.items.find((u) => u.id === assigneeId)?.teamId ?? null : null;

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 5 && requesterId;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const created = await ticketsApi.create({
        title: title.trim(),
        description: description.trim(),
        priority,
        customerId: requesterId!,
        assignedUserId: assigneeId,
        assignedTeamId: assigneeTeamId,
      });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setResult(created); // mostra a análise inteligente
      toast.success(`Ticket ${created.ticket.number} criado`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Não foi possível criar o ticket'));
    } finally {
      setSubmitting(false);
    }
  }

  // Etapa 2: ticket criado → análise inteligente.
  if (result) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col gap-md overflow-auto p-lg">
        <div className="flex items-center gap-sm rounded-md border border-success/30 bg-success/10 px-md py-sm text-sm text-success">
          <Sparkles className="h-4 w-4" /> Ticket <strong>{result.ticket.number}</strong> criado e analisado.
        </div>

        {result.likelyRootCause && (
          <div className="card-surface p-md">
            <p className="text-xs uppercase tracking-wide text-dim">Causa raiz provável</p>
            <p className="mt-1 text-sm font-medium">{result.likelyRootCause}</p>
          </div>
        )}

        <div>
          <p className="mb-sm flex items-center gap-1.5 text-sm font-semibold">
            <Lightbulb className="h-4 w-4 text-warning" /> Soluções recomendadas
          </p>
          {result.recommendations.length === 0 ? (
            <p className="text-sm text-dim">Nenhuma solução similar encontrada no histórico ainda.</p>
          ) : (
            <ul className="flex flex-col gap-sm">
              {result.recommendations.map((r) => (
                <li key={r.resolutionId} className="card-surface flex items-center gap-sm p-md">
                  <span className="flex-1 text-sm">{r.summary}</span>
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
                    {Math.round(r.score * 100)}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        </div>
        <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setTitle('');
              setDescription('');
              setRequesterId(null);
              setAssigneeId(null);
            }}
          >
            Criar outro
          </Button>
          <Button
            onClick={() => {
              openTicketTab(result.ticket);
              closeWindow(windowId);
            }}
          >
            Abrir ticket <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-md overflow-auto p-lg">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Assunto
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Resumo do problema" autoFocus />
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descrição
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={fieldClass}
          placeholder="O que está acontecendo, passos para reproduzir, impacto…"
        />
      </label>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Solicitante
          <AsyncCombobox options={userOptions} value={requesterId} onChange={setRequesterId} loading={users.isLoading} placeholder="Quem abriu?" allowClear={false} onCreate={openUsersIndexWindow} createLabel="Gerenciar usuários" />
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          Prioridade
          <Select<PriorityValue>
            value={priority}
            onChange={setPriority}
            options={[
              { value: Priority.Low, label: 'Baixa' },
              { value: Priority.Medium, label: 'Média' },
              { value: Priority.High, label: 'Alta' },
              { value: Priority.Critical, label: 'Crítica' },
            ]}
          />
        </div>
        <div className="flex flex-col gap-1.5 text-sm font-medium sm:col-span-2">
          Responsável
          <AsyncCombobox options={userOptions} value={assigneeId} onChange={setAssigneeId} loading={users.isLoading} placeholder="Atribuir a…" onCreate={openUsersIndexWindow} createLabel="Gerenciar usuários" />
          {assigneeTeamId != null && <span className="text-xs text-dim">Equipe definida automaticamente pelo responsável.</span>}
        </div>
      </div>

      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-sm border-t border-border bg-panel p-md">
        <span className="flex items-center gap-1.5 text-xs text-dim">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> Ao criar, o Orbit analisa e sugere soluções
        </span>
        <div className="flex gap-sm">
          <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
            Cancelar
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            {submitting ? <>Analisando… <Loader2 className="h-4 w-4 animate-spin" /></> : 'Criar ticket'}
          </Button>
        </div>
      </div>
    </form>
  );
}
