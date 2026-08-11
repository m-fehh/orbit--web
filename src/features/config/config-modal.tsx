'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { RotateCcw, Check, Lock } from 'lucide-react';
import { configApi } from '@/shared/api/endpoints';
import type { ConfigItemResponse } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { usePermissions } from '@/features/auth/use-permissions';
import { Modal } from '@/shared/ui/modal';
import { LoadingState, ErrorState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

/**
 * Configurações do tenant como MODAL com navegação por categoria (à esquerda). As configs são
 * GLOBAIS no tenant (não por usuário): quem tem `config.manage` altera para todos; quem só tem
 * `config.view` enxerga em modo leitura. Aberto pela engrenagem do header.
 */
export function ConfigModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations('config');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const { can } = usePermissions();
  const canManage = can('config.manage');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['config'],
    queryFn: () => configApi.list(),
    enabled: open,
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

  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (groups.length === 0) return;
    setActive((cur) => (cur && groups.some(([g]) => g === cur) ? cur : groups[0][0]));
  }, [groups]);

  const activeItems = groups.find(([g]) => g === active)?.[1] ?? [];
  const saving = setMut.isPending || resetMut.isPending;

  return (
    <Modal open={open} onClose={onClose} title={t('title')} subtitle={t('subtitle')} size="xl">
      {isLoading ? (
        <LoadingState label={tc('loading')} />
      ) : error ? (
        <ErrorState title={apiErrorMessage(error, tc('errorBody'))} onRetry={() => refetch()} retryLabel={tc('retry')} />
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">{t('empty')}</p>
      ) : (
        <div className="-m-lg flex h-[65vh] min-h-[380px]">
          {/* Rail de categorias */}
          <nav aria-label={t('title')} className="w-48 shrink-0 overflow-y-auto border-r border-border bg-bg-subtle/30 p-2">
            {groups.map(([group, items]) => (
              <button
                key={group}
                type="button"
                onClick={() => setActive(group)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  active === group ? 'bg-primary/10 font-semibold text-primary' : 'text-muted hover:bg-panel-2 hover:text-text',
                )}
              >
                <span className="truncate">{group}</span>
                <span className="shrink-0 rounded-full bg-panel-2 px-1.5 text-[10px] font-medium text-dim">{items.length}</span>
              </button>
            ))}
          </nav>

          {/* Conteúdo da categoria */}
          <div className="min-w-0 flex-1 overflow-y-auto">
            {!canManage && (
              <div className="flex items-center gap-2 border-b border-border bg-bg-subtle/40 px-5 py-2.5 text-xs text-muted">
                <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t('readOnly')}
              </div>
            )}
            <div className="divide-y divide-border">
              {activeItems.map((item) => (
                <ConfigRow
                  key={item.key}
                  item={item}
                  saving={saving}
                  readOnly={!canManage}
                  onSave={(value) => setMut.mutate({ key: item.key, value })}
                  onReset={() => resetMut.mutate(item.key)}
                  labels={{ default: t('default'), overridden: t('overridden'), save: tc('save'), reset: t('reset') }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ConfigRow({
  item, saving, readOnly, onSave, onReset, labels,
}: {
  item: ConfigItemResponse;
  saving: boolean;
  readOnly: boolean;
  onSave: (value: string) => void;
  onReset: () => void;
  labels: { default: string; overridden: string; save: string; reset: string };
}) {
  const isBool = item.type === 'Bool';
  const [draft, setDraft] = useState(item.effectiveValue);

  // Ressincroniza quando o valor efetivo muda (após salvar/resetar/refetch).
  useEffect(() => { setDraft(item.effectiveValue); }, [item.effectiveValue]);

  const disabled = saving || readOnly;
  const dirty = !isBool && !readOnly && draft !== item.effectiveValue;

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
            disabled={disabled}
            onChange={(checked) => { setDraft(String(checked)); onSave(String(checked)); }}
          />
        ) : (
          <>
            <input
              type={inputType}
              value={draft}
              disabled={disabled}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onSave(draft); }}
              className="w-44 rounded border border-border bg-bg-subtle px-2.5 py-1.5 text-sm text-text focus:border-primary outline-none disabled:opacity-60"
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
        {item.isOverridden && !readOnly && (
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
