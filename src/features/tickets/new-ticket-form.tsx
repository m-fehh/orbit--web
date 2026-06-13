'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ticketsApi } from '@/shared/api/endpoints';
import { Priority, type PriorityValue } from '@/shared/api/types';
import { useWindowStore } from '@/features/windows/window-store';
import { useTabStore } from '@/features/workspace/tab-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

const schema = z.object({
  title: z.string().min(3, 'Título muito curto'),
  description: z.string().min(5, 'Descreva o problema'),
  priority: z.coerce.number().min(1).max(4),
  customerId: z.coerce.number().min(1, 'Informe o cliente'),
  assignedTeamId: z.coerce.number().optional(),
});
type FormValues = z.input<typeof schema>;

const fieldClass =
  'w-full rounded border border-border bg-bg-subtle px-md py-2 text-sm text-text outline-none focus:border-primary';

/** Formulário de criação de ticket (renderizado dentro de uma janela). */
export function NewTicketForm({ windowId }: { windowId: string }) {
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const openTab = useTabStore((s) => s.openTab);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: Priority.Medium },
  });

  async function onSubmit(values: FormValues) {
    try {
      const created = await ticketsApi.create({
        title: values.title,
        description: values.description,
        priority: Number(values.priority) as PriorityValue,
        customerId: Number(values.customerId),
        assignedTeamId: values.assignedTeamId ? Number(values.assignedTeamId) : null,
      });
      toast.success(`Ticket ${created.ticket.number} criado`);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      closeWindow(windowId);
      openTab({
        kind: 'ticket',
        params: { id: created.ticket.id },
        title: `#${created.ticket.number}`,
        icon: 'ticket',
      });
    } catch {
      toast.error('Não foi possível criar o ticket');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md p-lg" noValidate>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Título
        <Input invalid={!!errors.title} placeholder="Resumo do problema" autoFocus {...register('title')} />
        {errors.title && <span className="text-xs text-danger">{errors.title.message}</span>}
      </label>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Descrição
        <textarea
          rows={5}
          className={fieldClass}
          placeholder="Detalhe o que está acontecendo, passos para reproduzir, impacto..."
          {...register('description')}
        />
        {errors.description && <span className="text-xs text-danger">{errors.description.message}</span>}
      </label>

      <div className="grid grid-cols-2 gap-md">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Prioridade
          <select className={fieldClass} {...register('priority')}>
            <option value={Priority.Low}>Baixa</option>
            <option value={Priority.Medium}>Média</option>
            <option value={Priority.High}>Alta</option>
            <option value={Priority.Critical}>Crítica</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Cliente (ID)
          <Input type="number" min={1} invalid={!!errors.customerId} {...register('customerId')} />
          {errors.customerId && <span className="text-xs text-danger">{errors.customerId.message}</span>}
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Equipe (ID, opcional)
        <Input type="number" min={1} {...register('assignedTeamId')} />
      </label>

      <div className="mt-sm flex justify-end gap-sm">
        <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Criar ticket
        </Button>
      </div>
    </form>
  );
}
