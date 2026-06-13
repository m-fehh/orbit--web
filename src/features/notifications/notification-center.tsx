'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, CheckCheck, Wifi, WifiOff, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '@/shared/api/endpoints';
import { useSignalR } from '@/features/notifications/use-signalr';
import { useAuthStore } from '@/features/auth/auth-store';
import { formatRelative } from '@/shared/lib/datetime';
import type { Locale } from '@/shared/i18n/config';
import type { NotificationResponse } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

/** Sino + drawer de notificações, com atualização em tempo real (SignalR). */
export function NotificationCenter() {
  const t = useTranslations('notifications');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const authenticated = useAuthStore((s) => s.status === 'authenticated');

  const unread = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    enabled: authenticated,
    refetchInterval: 60_000,
  });

  const list = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => notificationsApi.list(1, 20),
    enabled: authenticated && open,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['notifications'] });

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });
  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  // Tempo real: ao receber, atualiza contadores/lista e mostra um toast.
  const { connected } = useSignalR(
    'ReceiveNotification',
    (message) => {
      if (typeof message === 'string') toast(message);
      invalidate();
    },
    authenticated,
  );

  const count = unread.data?.unread ?? 0;

  function openItem(n: NotificationResponse) {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded text-muted hover:bg-panel-2 hover:text-text"
        aria-label={t('title')}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('title')}>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-sm flex-col border-l border-border bg-panel shadow-lg">
            <header className="flex items-center justify-between border-b border-border px-md py-sm">
              <div className="flex items-center gap-sm">
                <h2 className="text-sm font-semibold">{t('title')}</h2>
                <span
                  className="text-dim"
                  title={connected ? t('live') : t('offline')}
                  aria-label={connected ? t('live') : t('offline')}
                >
                  {connected ? <Wifi className="h-3.5 w-3.5 text-success" /> : <WifiOff className="h-3.5 w-3.5" />}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={count === 0 || markAll.isPending}
                  className="inline-flex items-center gap-1 rounded px-sm py-1 text-xs text-muted hover:bg-panel-2 hover:text-text disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden /> {t('markAllRead')}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-panel-2"
                  aria-label={t('title')}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto">
              {(list.data?.items.length ?? 0) === 0 ? (
                <p className="px-md py-2xl text-center text-sm text-dim">{t('empty')}</p>
              ) : (
                <ul>
                  {list.data?.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={cn(
                          'flex w-full flex-col gap-0.5 border-b border-border px-md py-sm text-left hover:bg-panel-2',
                          !n.isRead && 'bg-primary-soft',
                        )}
                      >
                        <span className="flex items-center gap-sm">
                          {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
                          <span className="text-sm font-medium text-text">{n.title}</span>
                        </span>
                        {n.message && <span className="text-xs text-muted">{n.message}</span>}
                        {n.createdAt && (
                          <span className="text-[11px] text-dim">{formatRelative(n.createdAt, locale)}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
