'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/utils';
import { Portal } from '@/shared/ui/portal';

export interface CreatableOption {
  id: number;
  label: string;
  color?: string | null;
  group?: string | null;
}

export interface CreatableComboboxProps {
  options: CreatableOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  onCreate?: (name: string) => Promise<CreatableOption | null> | void;
  createLabel?: string;
  max?: number;
}

export function CreatableCombobox({
  options,
  value,
  onChange,
  loading,
  placeholder,
  emptyText,
  onCreate,
  createLabel,
  max,
}: CreatableComboboxProps) {
  const tUi = useTranslations('ui');
  const resolvedPlaceholder = placeholder ?? tUi('select');
  const resolvedEmptyText = emptyText ?? tUi('nothingFound');
  const resolvedCreateLabel = createLabel ?? tUi('create');
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.filter((o) => value.includes(o.id)), [options, value]);
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, term]);

  const canCreate = onCreate && term.trim().length >= 2 && !filtered.some((o) => o.label.toLowerCase() === term.trim().toLowerCase());

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      if (max && value.length >= max) return;
      onChange([...value, id]);
    }
  }

  function remove(id: number) {
    onChange(value.filter((v) => v !== id));
  }

  async function handleCreate() {
    if (!onCreate || !canCreate || creating) return;
    setCreating(true);
    try {
      const result = await onCreate(term.trim());
      if (result) {
        onChange([...value, result.id]);
        setTerm('');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 0); }}
        className={cn(
          'flex min-h-[40px] w-full cursor-pointer flex-wrap items-center gap-1 rounded-lg border px-2 py-1.5 transition-all',
          'bg-bg-subtle',
          open ? 'border-primary ring-[3px] ring-primary/10' : 'border-border hover:border-border-strong',
        )}
      >
        {selected.map((o) => (
          <span
            key={o.id}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary"
            style={o.color ? { backgroundColor: `${o.color}20`, color: o.color } : undefined}
          >
            {o.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
            {o.label}
            <button type="button" onClick={(e) => { e.stopPropagation(); remove(o.id); }} className="ml-0.5 rounded hover:bg-black/10">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {selected.length === 0 && <span className="text-sm text-dim px-1">{resolvedPlaceholder}</span>}
        <span className="ml-auto shrink-0 pl-1">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-dim" /> : <ChevronsUpDown className="h-4 w-4 text-dim" />}
        </span>
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-lg border border-border bg-panel shadow-xl">
            <div className="flex items-center gap-1 border-b border-border p-1.5">
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) { e.preventDefault(); void handleCreate(); } }}
                placeholder={tUi('searchOrCreate')}
                className="h-8 flex-1 rounded bg-bg-subtle px-3 text-sm outline-none placeholder:text-dim"
              />
              {canCreate && (
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={creating}
                  className="flex h-8 shrink-0 items-center gap-1 rounded px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  {resolvedCreateLabel} "{term.trim()}"
                </button>
              )}
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 && !canCreate ? (
                <li className="px-3 py-2 text-sm text-dim">{resolvedEmptyText}</li>
              ) : (
                filtered.map((o) => {
                  const checked = value.includes(o.id);
                  return (
                    <li key={o.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={checked}
                        onClick={() => toggle(o.id)}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panel-2 transition-colors',
                          checked && 'text-primary',
                        )}
                      >
                        <span className={cn(
                          'grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors',
                          checked ? 'border-primary bg-primary text-white' : 'border-border',
                        )}>
                          {checked && <Check className="h-3 w-3" />}
                        </span>
                        {o.color && <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                        <span className="flex-1 truncate">{o.label}</span>
                        {o.group && <span className="text-[10px] text-dim">{o.group}</span>}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
