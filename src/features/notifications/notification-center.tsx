'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell, CheckCheck, Wifi, WifiOff, X, UserCheck, AlertTriangle,
  Trophy, CheckCircle2, Mail, Timer, AtSign, type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { notificationsApi } from '@/shared/api/endpoints';
import { useSignalR } from '@/features/notifications/use-signalr';
import { useNotifPrefs, playNotificationSound, showDesktopNotification } from '@/features/notifications/notification-prefs';
import { useAuthStore } from '@/features/auth/auth-store';
import { formatRelative } from '@/shared/lib/datetime';
import type { Locale } from '@/shared/i18n/config';
import type { NotificationResponse } from '@/shared/api/types';
import { Portal } from '@/shared/ui/portal';
import { cn } from '@/shared/lib/utils';

/** Ícone + tom por tipo de notificação. */
const TYPE_META: Record<string, { Icon: LucideIcon; ring: string; bg: string; fg: string }> = {
  'ticket.assigned': { Icon: UserCheck, ring: 'ring-primary/20', bg: 'bg-primary/10', fg: 'text-primary' },
  'sla.breached': { Icon: AlertTriangle, ring: 'ring-danger/20', bg: 'bg-danger/10', fg: 'text-danger' },
  'sla.atrisk': { Icon: Timer, ring: 'ring-warning/20', bg: 'bg-warning/10', fg: 'text-warning' },
  'comment.mention': { Icon: AtSign, ring: 'ring-primary/20', bg: 'bg-primary/10', fg: 'text-primary' },
  'goal.achieved': { Icon: Trophy, ring: 'ring-warning/20', bg: 'bg-warning/10', fg: 'text-warning' },
  'goal.awarded': { Icon: Trophy, ring: 'ring-warning/20', bg: 'bg-warning/10', fg: 'text-warning' },
  'resolution': { Icon: CheckCircle2, ring: 'ring-success/20', bg: 'bg-success/10', fg: 'text-success' },
  'outbound.message': { Icon: Mail, ring: 'ring-primary/20', bg: 'bg-primary/10', fg: 'text-primary' },
};
const DEFAULT_META = { Icon: Bell, ring: 'ring-border', bg: 'bg-panel-2', fg: 'text-muted' };

/** Sino + drawer de notificações, com atualização em tempo real (SignalR). */
export function NotificationCenter() {
  const t = useTranslations('notifications');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const authenticated = useAuthStore((s) => s.status === 'authenticated');

  // Traduz por type + meta (idioma do usuário); cai para o texto salvo quando não há template.
  const resolveText = (n: NotificationResponse): { title: string; body: string } => {
    const base = `tpl.${n.type}`;
    const titleKey = `${base}.title` as Parameters<typeof t.has>[0];
    if (n.type && t.has(titleKey)) {
      let params: Record<string, string> = {};
      try { params = n.meta ? JSON.parse(n.meta) : {}; } catch { /* ignore */ }
      const title = t(titleKey as Parameters<typeof t>[0], params);
      const bodyKey = `${base}.body` as Parameters<typeof t.has>[0];
      const body = t.has(bodyKey) ? t(bodyKey as Parameters<typeof t>[0], params) : n.message;
      return { title, body };
    }
    return { title: n.title, body: n.message };
  };

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

  const { connected } = useSignalR(
    'ReceiveNotification',
    (message) => {
      const text = typeof message === 'string' ? message : t('title');
      if (typeof message === 'string') toast(message);
      const prefs = useNotifPrefs.getState();
      if (prefs.sound) playNotificationSound();
      if (prefs.desktop) showDesktopNotification(t('title'), text);
      invalidate();
    },
    authenticated,
  );

  const count = unread.data?.unread ?? 0;
  const items = useMemo(() => {
    const all = list.data?.items ?? [];
    return onlyUnread ? all.filter((n) => !n.isRead) : all;
  }, [list.data, onlyUnread]);

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
        <Portal>
          <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className="absolute inset-0" onClick={() => setOpen(false)} aria-hidden />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-2xl animate-slide-in">
              {/* Cabeçalho */}
              <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-gradient-to-r from-primary/8 to-transparent px-4">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-text">{t('title')}</p>
                  <p className="flex items-center gap-1 text-[11px] text-dim">
                    {connected ? <Wifi className="h-3 w-3 text-success" /> : <WifiOff className="h-3 w-3" />}
                    {connected ? t('live') : t('offline')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text"
                  aria-label={t('close')}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>

              {/* Filtro + marcar todas */}
              <div className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
                <div className="flex items-center gap-1 rounded-lg bg-bg-subtle p-0.5">
                  <button type="button" onClick={() => setOnlyUnread(false)} className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors', !onlyUnread ? 'bg-panel text-text shadow-sm' : 'text-muted hover:text-text')}>
                    {t('filterAll')}
                  </button>
                  <button type="button" onClick={() => setOnlyUnread(true)} className={cn('flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors', onlyUnread ? 'bg-panel text-text shadow-sm' : 'text-muted hover:text-text')}>
                    {t('filterUnread')}
                    {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{count}</span>}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => markAll.mutate()}
                  disabled={count === 0 || markAll.isPending}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted hover:bg-panel-2 hover:text-text disabled:opacity-40"
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden /> {t('markAllRead')}
                </button>
              </div>

              {/* Lista */}
              <div className="flex-1 overflow-y-auto p-2">
                {items.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Bell className="h-5 w-5" /></span>
                    <p className="text-sm text-muted">{onlyUnread ? t('emptyUnread') : t('empty')}</p>
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {items.map((n) => {
                      const meta = TYPE_META[n.type] ?? DEFAULT_META;
                      const { title, body } = resolveText(n);
                      return (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => openItem(n)}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel-2/60',
                              !n.isRead && 'bg-primary/5',
                            )}
                          >
                            <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full ring-1', meta.bg, meta.fg, meta.ring)}>
                              <meta.Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className={cn('truncate text-sm', n.isRead ? 'font-semibold text-text' : 'font-bold text-text')}>{title}</span>
                                {!n.isRead && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />}
                              </span>
                              {body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted">{body}</span>}
                              {n.createdAt && <span className="mt-1 block text-[11px] text-dim">{formatRelative(n.createdAt, locale)}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </Portal>
      )}
    </>
  );
}
