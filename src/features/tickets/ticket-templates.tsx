'use client';

import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { useTranslations } from 'next-intl';
import { LayoutTemplate, Plus, X, Check } from 'lucide-react';
import type { PriorityValue } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

/** Um modelo de ticket: campos pré-preenchidos reutilizáveis (definidos pelo usuário). */
export interface TicketTemplate {
  id: string;
  name: string;
  title: string;
  description: string;
  priority: PriorityValue;
  tagIds: number[];
}

const KEY = 'orbit.ticketTemplates';

function load(): TicketTemplate[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(KEY) || '[]'); } catch { return []; }
}
function save(list: TicketTemplate[]) {
  if (typeof window !== 'undefined') window.localStorage.setItem(KEY, JSON.stringify(list));
}

interface TemplateState {
  templates: TicketTemplate[];
  hydrated: boolean;
  hydrate: () => void;
  add: (tpl: Omit<TicketTemplate, 'id'>) => void;
  remove: (id: string) => void;
}

export const useTicketTemplates = create<TemplateState>((set, get) => ({
  templates: [],
  hydrated: false,
  hydrate: () => { if (!get().hydrated) set({ templates: load(), hydrated: true }); },
  add: (tpl) => {
    const id = `tpl_${Date.now().toString(36)}`;
    const next = [...get().templates, { ...tpl, id }];
    save(next);
    set({ templates: next });
  },
  remove: (id) => {
    const next = get().templates.filter((t) => t.id !== id);
    save(next);
    set({ templates: next });
  },
}));

/** Barra de modelos no topo do formulário de criação: aplicar, salvar o atual, remover. */
export function TemplateBar({ current, onApply }: {
  current: { title: string; description: string; priority: PriorityValue; tagIds: number[] };
  onApply: (tpl: TicketTemplate) => void;
}) {
  const t = useTranslations('newTicket');
  const { templates, hydrate, add, remove } = useTicketTemplates();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { hydrate(); }, [hydrate]);

  const canSave = current.title.trim().length >= 3 || current.description.trim().length >= 5;

  const commitSave = () => {
    const n = name.trim();
    if (!n) return;
    add({ name: n, title: current.title, description: current.description, priority: current.priority, tagIds: current.tagIds });
    setName('');
    setSaving(false);
  };

  if (templates.length === 0 && !saving && !canSave) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-dashed border-border bg-bg-subtle/40 p-2.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-dim">
        <LayoutTemplate className="h-3.5 w-3.5 text-primary" /> {t('templates')}
      </span>

      {templates.map((tpl) => (
        <span key={tpl.id} className="group inline-flex items-center rounded-full border border-border bg-panel text-xs">
          <button type="button" onClick={() => onApply(tpl)} className="rounded-l-full py-1 pl-2.5 pr-1.5 font-medium text-text hover:text-primary" title={t('applyTemplate')}>
            {tpl.name}
          </button>
          <button type="button" onClick={() => remove(tpl.id)} className="rounded-r-full py-1 pl-0.5 pr-1.5 text-dim hover:text-danger" aria-label={t('deleteTemplate')} title={t('deleteTemplate')}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {saving ? (
        <span className="inline-flex items-center gap-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitSave(); } if (e.key === 'Escape') { setSaving(false); setName(''); } }}
            autoFocus
            placeholder={t('templateName')}
            className="h-6 w-32 rounded-md border border-border bg-panel px-2 text-xs outline-none focus:border-primary"
          />
          <button type="button" onClick={commitSave} disabled={!name.trim()} className="grid h-6 w-6 place-items-center rounded-md bg-primary text-primary-fg disabled:opacity-40" aria-label={t('save')}>
            <Check className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => { setSaving(false); setName(''); }} className="grid h-6 w-6 place-items-center rounded-md text-dim hover:text-text" aria-label={t('cancel')}>
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      ) : (
        canSave && (
          <button type="button" onClick={() => setSaving(true)} className={cn('inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:border-primary hover:bg-primary/10')}>
            <Plus className="h-3 w-3" /> {t('saveAsTemplate')}
          </button>
        )
      )}
    </div>
  );
}
