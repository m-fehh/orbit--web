'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Plus, Send, Trash2, X, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { webhooksApi } from '@/shared/api/endpoints';
import type { WebhookSubscriptionResponse, WebhookEventInfo } from '@/shared/api/types';
import { apiErrorMessage } from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';
import { cn } from '@/shared/lib/utils';

/** "TicketCreated" -> "Ticket Created" (rótulo legível a partir da chave técnica). */
function humanize(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2');
}

function fmtDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

function ActiveBadge({ active, on, off }: { active: boolean; on: string; off: string }) {
  return (
    <span className={cn(
      'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
      active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
             : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
    )}>
      {active ? on : off}
    </span>
  );
}

export function WebhooksView() {
  const t = useTranslations('webhooks');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WebhookSubscriptionResponse | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<number>>(new Set());
  const [deliveriesFor, setDeliveriesFor] = useState<WebhookSubscriptionResponse | null>(null);

  const subsQuery = useQuery({ queryKey: ['webhooks'], queryFn: () => webhooksApi.list() });
  const eventsQuery = useQuery({ queryKey: ['webhook-events'], queryFn: () => webhooksApi.events(), staleTime: 5 * 60_000 });

  const items = Array.isArray(subsQuery.data) ? subsQuery.data : [];
  const catalog = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data]);

  /** value -> info (para rotular eventos numéricos vindos da API). */
  const eventByValue = useMemo(() => {
    const m = new Map<number, WebhookEventInfo>();
    for (const e of catalog) m.set(e.value, e);
    return m;
  }, [catalog]);

  /** catálogo agrupado por `group` (para o seletor no formulário). */
  const grouped = useMemo(() => {
    const g = new Map<string, WebhookEventInfo[]>();
    for (const e of catalog) {
      const arr = g.get(e.group) ?? [];
      arr.push(e);
      g.set(e.group, arr);
    }
    return Array.from(g.entries());
  }, [catalog]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['webhooks'] });

  const createMut = useMutation({
    mutationFn: (body: { name: string; url: string; secret: string; events: number[] }) => webhooksApi.create(body),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string; url: string; secret?: string; events: number[]; active: boolean } }) =>
      webhooksApi.update(id, body),
    onSuccess: () => { invalidate(); closeForm(); },
  });
  const removeMut = useMutation({
    mutationFn: (id: number) => webhooksApi.remove(id),
    onSuccess: () => { invalidate(); closeForm(); },
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setSelectedEvents(new Set());
    setShowForm(true);
  }, []);

  const openEdit = useCallback((row: WebhookSubscriptionResponse) => {
    setEditing(row);
    setSelectedEvents(new Set(row.events));
    setShowForm(true);
  }, []);

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setSelectedEvents(new Set());
  }

  const toggleEvent = (value: number) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = (fd.get('name') as string).trim();
    const url = (fd.get('url') as string).trim();
    const secret = ((fd.get('secret') as string) ?? '').trim();
    const active = fd.get('active') != null;
    const events = Array.from(selectedEvents);
    if (events.length === 0) return;

    if (editing) {
      updateMut.mutate({ id: editing.id, body: { name, url, secret: secret || undefined, events, active } });
    } else {
      createMut.mutate({ name, url, secret, events });
    }
  }, [editing, selectedEvents, createMut, updateMut]);

  const columns = useMemo<ColumnDef<WebhookSubscriptionResponse>[]>(() => [
    { field: 'name', header: t('name'), width: 200, sortable: true, filterable: true },
    { field: 'url', header: t('url'), width: 320, render: (v: string) => <span className="font-mono text-xs text-muted">{v}</span> },
    {
      field: 'events', header: t('events'), width: 260, sortable: false,
      render: (v: number[]) => {
        const list = Array.isArray(v) ? v : [];
        const shown = list.slice(0, 2);
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((val) => (
              <span key={val} className="inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                {humanize(eventByValue.get(val)?.key ?? String(val))}
              </span>
            ))}
            {list.length > shown.length && (
              <span className="text-[11px] text-muted">+{list.length - shown.length}</span>
            )}
            {list.length === 0 && <span className="text-muted">—</span>}
          </div>
        );
      },
    },
    {
      field: 'active', header: t('active'), width: 110, align: 'center',
      render: (v: boolean) => <ActiveBadge active={v} on={t('active')} off={t('inactive')} />,
    },
    { field: 'createdAt', header: t('createdAt'), width: 170, render: (v: string) => <span className="text-xs text-muted">{fmtDate(v)}</span> },
    {
      field: 'id', header: '', width: 130, sortable: false, filterable: false, align: 'right', sticky: 'right',
      render: (_v, row) => (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDeliveriesFor(row); }}
          className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted hover:border-primary hover:text-primary transition-colors"
        >
          <Send className="h-3 w-3" /> {t('deliveries')}
        </button>
      ),
    },
  ], [t, eventByValue]);

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
      </div>

      <DataGrid<WebhookSubscriptionResponse>
        gridId="webhooks"
        columns={columns}
        data={items}
        rowKey="id"
        loading={subsQuery.isLoading}
        error={subsQuery.error ? apiErrorMessage(subsQuery.error, tc('errorBody')) : null}
        onRefresh={() => subsQuery.refetch()}
        onRowClick={openEdit}
        emptyMessage={t('empty')}
        toolbar={
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            {t('newWebhook')}
          </button>
        }
      />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleSubmit}
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-panel p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold text-text">{editing ? t('editWebhook') : t('newWebhook')}</h2>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('name')}
              <input name="name" required defaultValue={editing?.name ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none" />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('url')}
              <input name="url" type="url" required placeholder="https://exemplo.com/webhook" defaultValue={editing?.url ?? ''} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none font-mono" />
            </label>

            <label className="flex flex-col gap-1 text-sm text-text">
              {t('secret')}
              <input name="secret" type="password" required={!editing} placeholder={editing ? t('secretKeep') : t('secretHint')} className="rounded border border-border bg-bg-subtle px-3 py-2 text-sm text-text focus:border-primary outline-none font-mono" />
              <span className="text-[11px] text-muted">{t('secretDesc')}</span>
            </label>

            <div className="flex flex-col gap-2 text-sm text-text">
              <span className="font-medium">{t('events')}</span>
              <div className="flex flex-col gap-3 rounded border border-border bg-bg-subtle p-3">
                {grouped.map(([group, evts]) => (
                  <div key={group} className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-dim">{group}</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {evts.map((evt) => (
                        <label key={evt.value} className="flex items-center gap-2 text-xs text-text cursor-pointer">
                          <input type="checkbox" checked={selectedEvents.has(evt.value)} onChange={() => toggleEvent(evt.value)} className="rounded border-border" />
                          {humanize(evt.key)}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
                {grouped.length === 0 && <span className="text-xs text-muted">{tc('loading')}</span>}
              </div>
              {selectedEvents.size === 0 && <span className="text-[11px] text-danger">{t('eventsRequired')}</span>}
            </div>

            {editing && (
              <label className="flex items-center gap-2 text-sm text-text">
                <input type="checkbox" name="active" defaultChecked={editing.active} className="rounded border-border" />
                {t('activeLabel')}
              </label>
            )}

            <div className="flex justify-end gap-2 pt-2">
              {editing && (
                <button
                  type="button"
                  onClick={() => removeMut.mutate(editing.id)}
                  className="mr-auto inline-flex items-center gap-1.5 rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t('delete')}
                </button>
              )}
              <button type="button" onClick={closeForm} className="rounded border border-border px-4 py-2 text-sm text-muted hover:bg-bg-subtle">
                {tc('cancel')}
              </button>
              <button type="submit" disabled={createMut.isPending || updateMut.isPending || selectedEvents.size === 0} className="rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {tc('save')}
              </button>
            </div>
          </form>
        </div>
      )}

      {deliveriesFor && (
        <DeliveriesModal
          subscription={deliveriesFor}
          eventByValue={eventByValue}
          onClose={() => setDeliveriesFor(null)}
        />
      )}
    </div>
  );
}

function DeliveriesModal({
  subscription,
  eventByValue,
  onClose,
}: {
  subscription: WebhookSubscriptionResponse;
  eventByValue: Map<number, WebhookEventInfo>;
  onClose: () => void;
}) {
  const t = useTranslations('webhooks');
  const tc = useTranslations('common');
  const { data, isLoading, error } = useQuery({
    queryKey: ['webhook-deliveries', subscription.id],
    queryFn: () => webhooksApi.deliveries(subscription.id),
  });
  const rows = Array.isArray(data) ? data : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-panel shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-base font-semibold text-text">{t('deliveriesTitle')}</h2>
            <p className="text-xs text-muted">{subscription.name}</p>
          </div>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md text-muted hover:bg-bg-subtle" aria-label={tc('close')}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && <p className="py-8 text-center text-sm text-muted">{tc('loading')}</p>}
          {error && <p className="py-8 text-center text-sm text-danger">{apiErrorMessage(error, tc('errorBody'))}</p>}
          {!isLoading && !error && rows.length === 0 && <p className="py-8 text-center text-sm text-muted">{t('noDeliveries')}</p>}
          {!isLoading && !error && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3">{t('event')}</th>
                  <th className="py-2 pr-3">{t('status')}</th>
                  <th className="py-2 pr-3">{t('attempts')}</th>
                  <th className="py-2">{t('createdAt')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">{humanize(eventByValue.get(d.event)?.key ?? String(d.event))}</td>
                    <td className="py-2 pr-3">
                      {d.delivered ? (
                        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> {d.httpStatusCode ?? 200}</span>
                      ) : d.lastError ? (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400" title={d.lastError}><XCircle className="h-3.5 w-3.5" /> {d.httpStatusCode ?? t('failed')}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> {t('pending')}</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 tabular-nums">{d.attemptCount}</td>
                    <td className="py-2 text-xs text-muted">{fmtDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
