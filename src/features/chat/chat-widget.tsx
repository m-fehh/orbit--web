'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { MessageSquare, X, Plus, ArrowLeft, Send, Users, Search, Check } from 'lucide-react';
import { chatApi, usersApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type ChatConversationResponse } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useSignalR } from '@/features/notifications/use-signalr';
import { Portal } from '@/shared/ui/portal';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { LoadingState } from '@/shared/ui/states';
import { cn } from '@/shared/lib/utils';

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

/** Chat interno: ícone no header (com não lidas) + painel lateral (lista, thread, nova conversa). */
export function ChatWidget() {
  const t = useTranslations('chat');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'thread' | 'new'>('list');
  const [activeId, setActiveId] = useState<number | null>(null);

  const unread = useQuery({ queryKey: ['chat', 'unread'], queryFn: () => chatApi.unreadCount(), retry: false, refetchInterval: 60_000 });
  const conversations = useQuery({ queryKey: ['chat', 'conversations'], queryFn: () => chatApi.conversations(), enabled: open, retry: false });

  // Tempo real: qualquer mensagem/conversa nova revalida os dados abertos.
  useSignalR('chat.message', () => {
    qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
    qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    qc.invalidateQueries({ queryKey: ['chat', 'messages'] });
  }, true);
  useSignalR('chat.conversation', () => {
    qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
  }, true);

  const openConversation = (id: number) => {
    setActiveId(id);
    setView('thread');
    chatApi.markRead(id).then(() => {
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    }).catch(() => {});
  };

  const unreadTotal = unread.data?.unread ?? 0;
  const activeConv = conversations.data?.find((c) => c.id === activeId) ?? null;

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setView('list'); }}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-panel-2 hover:text-text"
        aria-label={t('title')}
        title={t('title')}
      >
        <MessageSquare className="h-4 w-4" aria-hidden />
        {unreadTotal > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-fg">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-2xl animate-slide-in">
              {/* Header */}
              <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
                {view !== 'list' ? (
                  <button type="button" onClick={() => setView('list')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('back')}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                ) : (
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-4 w-4" /></span>
                )}
                <p className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                  {view === 'thread' ? (activeConv?.name ?? t('title')) : view === 'new' ? t('newConversation') : t('title')}
                </p>
                {view === 'list' && (
                  <button type="button" onClick={() => setView('new')} className="grid h-8 w-8 place-items-center rounded-lg text-primary hover:bg-primary/10" aria-label={t('newConversation')} title={t('newConversation')}>
                    <Plus className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('close')}>
                  <X className="h-4 w-4" />
                </button>
              </header>

              {view === 'list' && <ConversationList data={conversations.data} loading={conversations.isLoading} onOpen={openConversation} onNew={() => setView('new')} t={t} />}
              {view === 'thread' && activeId != null && <Thread conversationId={activeId} t={t} />}
              {view === 'new' && <NewConversation t={t} onCreated={(c) => openConversation(c.id)} />}
            </aside>
          </div>
        </Portal>
      )}
    </>
  );
}

function ConversationList({ data, loading, onOpen, onNew, t }: {
  data: ChatConversationResponse[] | undefined;
  loading: boolean;
  onOpen: (id: number) => void;
  onNew: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  if (loading) return <LoadingState />;
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></span>
        <p className="text-sm text-muted">{t('empty')}</p>
        <Button size="sm" className="gap-1.5" onClick={onNew}><Plus className="h-3.5 w-3.5" /> {t('newConversation')}</Button>
      </div>
    );
  }
  return (
    <ul className="flex-1 divide-y divide-border/40 overflow-y-auto">
      {data.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2/50">
            <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-full text-xs font-bold', c.isGroup ? 'bg-primary/10 text-primary' : 'bg-panel-2 text-muted')}>
              {c.isGroup ? <Users className="h-4 w-4" /> : initials(c.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-text">{c.name}</span>
                {c.lastMessageAt && <span className="ml-auto shrink-0 text-[10px] text-dim">{new Date(c.lastMessageAt).toLocaleDateString()}</span>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted">{c.lastMessage ?? '—'}</span>
            </span>
            {c.unreadCount > 0 && (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-fg">{c.unreadCount}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Thread({ conversationId, t }: { conversationId: number; t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatApi.messages(conversationId),
    retry: false,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data]);

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(conversationId, body),
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
    },
  });

  const submit = () => { const b = text.trim(); if (b && !send.isPending) send.mutate(b); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } };

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.isLoading ? (
          <LoadingState />
        ) : (messages.data?.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-dim">{t('threadEmpty')}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {messages.data!.map((m) => {
              const mine = m.senderId === meId;
              return (
                <div key={m.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                  {!mine && <span className="mb-0.5 px-1 text-[10px] font-medium text-dim">{m.senderName}</span>}
                  <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-tr-sm bg-primary text-primary-fg' : 'rounded-tl-sm bg-panel-2 text-text')}>
                    <p className="whitespace-pre-wrap break-words">{m.body}</p>
                  </div>
                  <span className="mt-0.5 px-1 text-[9px] text-dim">{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={t('messagePlaceholder')}
          className="max-h-28 flex-1 resize-none rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <Button size="icon" onClick={submit} loading={send.isPending} disabled={!text.trim()} aria-label={t('send')}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

function NewConversation({ onCreated, t }: { onCreated: (c: ChatConversationResponse) => void; t: ReturnType<typeof useTranslations> }) {
  const meId = useAuthStore((s) => s.user?.id);
  const [term, setTerm] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');

  const users = useQuery({ queryKey: ['users', 'chat-picker'], queryFn: () => usersApi.list(1, 200), retry: false });
  const options = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (users.data?.items ?? [])
      .filter((u) => u.id !== meId)
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q));
  }, [users.data, term, meId]);

  const isGroup = selected.length > 1;

  const create = useMutation({
    mutationFn: () => chatApi.create({ userIds: selected, isGroup, name: isGroup ? groupName.trim() || null : null }),
    onSuccess: (conv) => onCreated(conv),
  });

  const toggle = (id: number) => setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('searchUsers')} className="pl-9" />
        </div>
        {isGroup && (
          <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t('groupNamePlaceholder')} />
        )}
      </div>

      <ul className="flex-1 overflow-y-auto p-2">
        {users.isLoading ? (
          <LoadingState />
        ) : options.length === 0 ? (
          <p className="py-8 text-center text-sm text-dim">{t('noUsers')}</p>
        ) : (
          options.map((u) => {
            const on = selected.includes(u.id);
            return (
              <li key={u.id}>
                <button type="button" onClick={() => toggle(u.id)} className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-panel-2/50', on && 'bg-primary/5')}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel-2 text-xs font-bold text-muted">{initials(u.name)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text">{u.name}</span>
                    {u.email && <span className="block truncate text-[11px] text-dim">{u.email}</span>}
                  </span>
                  <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border', on ? 'border-primary bg-primary text-primary-fg' : 'border-border')}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      <div className="shrink-0 border-t border-border p-3">
        <Button
          className="w-full"
          loading={create.isPending}
          disabled={selected.length === 0 || (isGroup && groupName.trim() === '')}
          onClick={() => create.mutate()}
        >
          {isGroup ? t('createGroup', { count: selected.length }) : t('startChat')}
        </Button>
      </div>
    </div>
  );
}
