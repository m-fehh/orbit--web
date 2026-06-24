'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, X, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/utils';

export interface ComboOption {
  id: number;
  label: string;
  hint?: string;
}

/**
 * Combobox de busca por entidade: filtra opções por texto e guarda o `id`
 * selecionado (mesmo contrato {id, label} do SearchController do Axion, porém
 * resolvido no cliente — ideal para catálogos pequenos como perfis/equipes).
 */
export function AsyncCombobox({
  options,
  value,
  onChange,
  loading,
  placeholder,
  emptyText,
  allowClear = true,
  onCreate,
  createLabel,
  disabled = false,
}: {
  options: ComboOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  loading?: boolean;
  placeholder?: string;
  emptyText?: string;
  allowClear?: boolean;
  /** Quando presente, mostra um botão "+" ao lado para abrir o cadastro/listagem. */
  onCreate?: () => void;
  createLabel?: string;
  disabled?: boolean;
}) {
  const tUi = useTranslations('ui');
  const resolvedPlaceholder = placeholder ?? tUi('select');
  const resolvedEmptyText = emptyText ?? tUi('nothingFound');
  const resolvedCreateLabel = createLabel ?? tUi('register');
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;
  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || String(o.id).includes(q));
  }, [options, term]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          'flex h-10 w-full items-center gap-sm rounded-md border border-border bg-bg-subtle px-md text-sm outline-none transition-all',
          disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-border-strong focus:border-primary focus:ring-4 focus:ring-primary/15',
        )}
      >
        <span className={cn('flex-1 truncate text-left', !selected && 'text-dim')}>
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin text-dim" aria-hidden />
        ) : selected && allowClear ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label={tUi('clear')}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="grid h-5 w-5 place-items-center rounded text-dim hover:text-danger"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </span>
        ) : (
          <ChevronsUpDown className="h-4 w-4 text-dim" aria-hidden />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-md border border-border bg-panel shadow-lg">
            {/* Campo de busca com o botão "+" embutido à direita (criar nova entidade). */}
            <div className="flex items-center gap-1 border-b border-border p-1.5">
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={tUi('searchEllipsis')}
                className="h-8 flex-1 rounded bg-bg-subtle px-md text-sm outline-none placeholder:text-dim"
              />
              {onCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCreate();
                  }}
                  title={resolvedCreateLabel}
                  aria-label={resolvedCreateLabel}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-primary-soft hover:text-primary"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-md py-sm text-sm text-dim">{resolvedEmptyText}</li>
              ) : (
                filtered.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={o.id === value}
                      onClick={() => {
                        onChange(o.id);
                        setOpen(false);
                        setTerm('');
                      }}
                      className={cn(
                        'flex w-full items-center gap-sm px-md py-sm text-left text-sm hover:bg-panel-2',
                        o.id === value && 'text-primary',
                      )}
                    >
                      <span className="flex-1 truncate">
                        {o.label}
                        {o.hint && <span className="ml-2 text-xs text-dim">{o.hint}</span>}
                      </span>
                      <span className="font-mono text-xs text-dim">#{o.id}</span>
                      {o.id === value && <Check className="h-4 w-4" aria-hidden />}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
