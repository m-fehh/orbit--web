'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RotateCcw, Check, SlidersHorizontal } from 'lucide-react';
import { configApi } from '@/shared/api/endpoints';
import type { ConfigItemResponse } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

export function ConfigView() {
  const t = useTranslations('config');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.list(),
  });

  const setMut = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => configApi.set(key, value),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });
  const resetMut = useMutation({
    mutationFn: (key: string) => configApi.reset(key),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['config'] }),
  });

  const groups = useMemo(() => {
    const g = new Map<string, ConfigItemResponse[]>();
    for (const it of data ?? []) {
      const arr = g.get(it.group) ?? [];
      arr.push(it);
      g.set(it.group, arr);
    }
    return Array.from(g.entries());
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-sm border-b border-border p-md">
        <SlidersHorizontal className="h-5 w-5 text-primary" aria-hidden />
        <div>
          <h1 className="text-lg font-bold">{t('title')}</h1>
          <p className="text-xs text-muted">{t('subtitle')}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {isLoading ? (
          <LoadingState label={tc('loading')} />
        ) : error ? (
          <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-lg">
            {groups.map(([group, items]) => (
              <section key={group} className="rounded-xl border border-border bg-panel">
                <header className="border-b border-border px-5 py-3">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{group}</h2>
                </header>
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <ConfigRow
                      key={item.key}
                      item={item}
                      saving={setMut.isPending || resetMut.isPending}
                      onSave={(value) => setMut.mutate({ key: item.key, value })}
                      onReset={() => resetMut.mutate(item.key)}
                      labels={{ default: t('default'), overridden: t('overridden'), save: tc('save'), reset: t('reset') }}
                    />
                  ))}
                </div>
              </section>
            ))}
            {groups.length === 0 && <p className="py-10 text-center text-sm text-muted">{t('empty')}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function ConfigRow({
  item, saving, onSave, onReset, labels,
}: {
  item: ConfigItemResponse;
  saving: boolean;
  onSave: (value: string) => void;
  onReset: () => void;
  labels: { default: string; overridden: string; save: string; reset: string };
}) {
  const isBool = item.type === 'Bool';
  const [draft, setDraft] = useState(item.effectiveValue);

  // Ressincroniza quando o valor efetivo muda (após salvar/resetar/refetch).
  useEffect(() => { setDraft(item.effectiveValue); }, [item.effectiveValue]);

  const dirty = !isBool && draft !== item.effectiveValue;

  const inputType = item.type === 'Int' || item.type === 'Decimal' ? 'number'
    : item.type === 'Date' ? 'date' : 'text';

  return (
    <div className="flex items-start gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-text">{item.description}</span>
          {item.isOverridden && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{labels.overridden}</span>
          )}
        </div>
        <code className="text-[11px] text-dim">{item.key}</code>
        {!item.isOverridden && (
          <p className="mt-0.5 text-[11px] text-muted">{labels.default}: <span className="font-mono">{item.defaultValue}</span></p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isBool ? (
          <Toggle
            checked={draft === 'true'}
            disabled={saving}
            onChange={(checked) => { setDraft(String(checked)); onSave(String(checked)); }}
          />
        ) : (
          <>
            <input
              type={inputType}
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onSave(draft); }}
              className="w-44 rounded border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-text focus:border-primary outline-none"
            />
            {dirty && (
              <button
                type="button"
                onClick={() => onSave(draft)}
                disabled={saving}
                title={labels.save}
                className="grid h-8 w-8 place-items-center rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
              </button>
            )}
          </>
        )}
        {item.isOverridden && (
          <button
            type="button"
            onClick={onReset}
            disabled={saving}
            title={labels.reset}
            className="grid h-8 w-8 place-items-center rounded border border-border text-muted hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-border',
      )}
    >
      <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}
