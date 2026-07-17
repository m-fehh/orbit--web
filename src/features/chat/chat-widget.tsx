'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, X, Plus, ArrowLeft, Send, Users, Search, Check,
  Pencil, Trash2, Paperclip, Download, FileText,
} from 'lucide-react';
import { chatApi, usersApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type ChatConversationResponse, type ChatMessageResponse } from '@/shared/api/types';
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

function OnlineDot({ online }: { online: boolean }) {
  return <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-panel', online ? 'bg-success' : 'bg-dim/40')} />;
}

/** Chat interno: ícone no header (não lidas) + painel lateral com lista, thread e nova conversa. */
export function ChatWidget() {
  const t = useTranslations('chat');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'thread' | 'new'>('list');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [typingByConv, setTypingByConv] = useState<Record<number, string>>({});
  const typingTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const unread = useQuery({ queryKey: ['chat', 'unread'], queryFn: () => chatApi.unreadCount(), retry: false, refetchInterval: 60_000 });
  const conversations = useQuery({ queryKey: ['chat', 'conversations'], queryFn: () => chatApi.conversations(), enabled: open, retry: false });
  const presence = useQuery({ queryKey: ['chat', 'presence'], queryFn: () => chatApi.presence(), retry: false, refetchInterval: 120_000 });
  const onlineSet = useMemo(() => new Set(presence.data ?? []), [presence.data]);

  // Tempo real: todos os eventos chegam via 'ReceiveEvent' (nome + payload).
  useSignalR('ReceiveEvent', (...args: unknown[]) => {
    const ev = args[0] as string;
    const payload = args[1] as Record<string, unknown> | undefined;
    if (ev === 'chat.message' || ev === 'chat.message.updated' || ev === 'chat.message.deleted') {
      qc.invalidateQueries({ queryKey: ['chat', 'messages'] });
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
    } else if (ev === 'chat.conversation') {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
    } else if (ev === 'chat.typing' && payload) {
      const convId = Number(payload.conversationId);
      const name = String(payload.name ?? '');
      setTypingByConv((prev) => ({ ...prev, [convId]: name }));
      clearTimeout(typingTimers.current[convId]);
      typingTimers.current[convId] = setTimeout(() => {
        setTypingByConv((prev) => { const n = { ...prev }; delete n[convId]; return n; });
      }, 3500);
    } else if (ev === 'presence' && payload) {
      const uid = Number(payload.userId);
      const online = payload.online === true;
      qc.setQueryData<number[]>(['chat', 'presence'], (prev) => {
        const set = new Set(prev ?? []);
        if (online) set.add(uid); else set.delete(uid);
        return [...set];
      });
    }
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

              {view === 'list' && <ConversationList data={conversations.data} loading={conversations.isLoading} onlineSet={onlineSet} onOpen={openConversation} onNew={() => setView('new')} t={t} />}
              {view === 'thread' && activeId != null && <Thread conversationId={activeId} typingName={typingByConv[activeId]} t={t} />}
              {view === 'new' && <NewConversation t={t} onlineSet={onlineSet} onCreated={(c) => openConversation(c.id)} />}
            </aside>
          </div>
        </Portal>
      )}
    </>
  );
}

function ConversationList({ data, loading, onlineSet, onOpen, onNew, t }: {
  data: ChatConversationResponse[] | undefined;
  loading: boolean;
  onlineSet: Set<number>;
  onOpen: (id: number) => void;
  onNew: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const meId = useAuthStore((s) => s.user?.id);
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
      {data.map((c) => {
        const other = c.isGroup ? null : c.participants.find((p) => p.userId !== meId);
        const online = other ? onlineSet.has(other.userId) : false;
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-panel-2/50">
              <span className="relative shrink-0">
                <span className={cn('grid h-10 w-10 place-items-center rounded-full text-xs font-bold', c.isGroup ? 'bg-primary/10 text-primary' : 'bg-panel-2 text-muted')}>
                  {c.isGroup ? <Users className="h-4 w-4" /> : initials(c.name)}
                </span>
                {!c.isGroup && <OnlineDot online={online} />}
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
        );
      })}
    </ul>
  );
}

function Thread({ conversationId, typingName, t }: { conversationId: number; typingName?: string; t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);

  const messages = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatApi.messages(conversationId),
    retry: false,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.data, typingName]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['chat', 'messages', conversationId] });
    qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
  };

  const send = useMutation({
    mutationFn: (body: string) => chatApi.send(conversationId, body),
    onSuccess: () => { setText(''); invalidate(); },
  });
  const edit = useMutation({
    mutationFn: (v: { id: number; body: string }) => chatApi.editMessage(v.id, v.body),
    onSuccess: () => { setEditing(null); invalidate(); },
    onError: (e) => toast.error(apiErrorMessage(e, t('editError'))),
  });
  const del = useMutation({
    mutationFn: (id: number) => chatApi.deleteMessage(id),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e, t('deleteError'))),
  });
  const upload = useMutation({
    mutationFn: (file: File) => chatApi.sendAttachment(conversationId, file),
    onSuccess: invalidate,
    onError: (e) => toast.error(apiErrorMessage(e, t('uploadError'))),
  });

  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTyping.current > 2000) {
      lastTyping.current = now;
      chatApi.typing(conversationId).catch(() => {});
    }
  };

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
            {messages.data!.map((m) => (
              <MessageBubble
                key={m.id}
                m={m}
                mine={m.senderId === meId}
                editing={editing?.id === m.id ? editing.body : null}
                onStartEdit={() => setEditing({ id: m.id, body: m.body })}
                onChangeEdit={(v) => setEditing({ id: m.id, body: v })}
                onSaveEdit={() => { if (editing && editing.body.trim()) edit.mutate({ id: m.id, body: editing.body.trim() }); }}
                onCancelEdit={() => setEditing(null)}
                onDelete={() => del.mutate(m.id)}
                t={t}
              />
            ))}
          </div>
        )}
        {typingName && (
          <p className="mt-2 px-1 text-[11px] italic text-dim">{t('typing', { name: typingName })}</p>
        )}
      </div>

      <div className="flex shrink-0 items-end gap-2 border-t border-border p-3">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); if (fileRef.current) fileRef.current.value = ''; }} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text disabled:opacity-50" aria-label={t('attach')} title={t('attach')}>
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); notifyTyping(); }}
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

function MessageBubble({ m, mine, editing, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, onDelete, t }: {
  m: ChatMessageResponse;
  mine: boolean;
  editing: string | null;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className={cn('group flex flex-col', mine ? 'items-end' : 'items-start')}>
      {!mine && <span className="mb-0.5 px-1 text-[10px] font-medium text-dim">{m.senderName}</span>}
      {editing !== null ? (
        <div className="w-full max-w-[85%]">
          <textarea
            value={editing}
            onChange={(e) => onChangeEdit(e.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-primary bg-bg-subtle px-2.5 py-1.5 text-sm outline-none"
            autoFocus
          />
          <div className="mt-1 flex justify-end gap-1.5">
            <button type="button" onClick={onCancelEdit} className="rounded px-2 py-0.5 text-[11px] text-dim hover:text-text">{t('cancel')}</button>
            <button type="button" onClick={onSaveEdit} className="rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-fg">{t('saveEdit')}</button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-1.5">
          {mine && (
            <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" onClick={onStartEdit} className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-panel-2 hover:text-text" aria-label={t('edit')}><Pencil className="h-3 w-3" /></button>
              <button type="button" onClick={onDelete} className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-danger/10 hover:text-danger" aria-label={t('delete')}><Trash2 className="h-3 w-3" /></button>
            </span>
          )}
          <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm shadow-sm', mine ? 'rounded-tr-sm bg-primary text-primary-fg' : 'rounded-tl-sm bg-panel-2 text-text')}>
            {m.attachmentName && <ChatAttachment m={m} mine={mine} t={t} />}
            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
          </div>
        </div>
      )}
      <span className="mt-0.5 px-1 text-[9px] text-dim">
        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        {m.editedAt && ` · ${t('edited')}`}
      </span>
    </div>
  );
}

function ChatAttachment({ m, mine, t }: { m: ChatMessageResponse; mine: boolean; t: ReturnType<typeof useTranslations> }) {
  const [url, setUrl] = useState<string | null>(null);
  const isImage = (m.attachmentContentType ?? '').startsWith('image/');

  useEffect(() => {
    if (!isImage) return;
    let revoked: string | null = null;
    let active = true;
    chatApi.attachmentBlob(m.id).then((blob) => {
      if (!active) return;
      const u = URL.createObjectURL(blob);
      revoked = u;
      setUrl(u);
    }).catch(() => {});
    return () => { active = false; if (revoked) URL.revokeObjectURL(revoked); };
  }, [m.id, isImage]);

  const download = () => {
    chatApi.attachmentBlob(m.id).then((blob) => {
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.download = m.attachmentName ?? 'arquivo';
      a.click();
      URL.revokeObjectURL(u);
    }).catch(() => toast.error(t('downloadError')));
  };

  if (isImage) {
    return url
      ? <img src={url} alt={m.attachmentName ?? ''} className="mb-1 max-h-56 max-w-full cursor-pointer rounded-lg" onClick={download} />
      : <div className="mb-1 flex h-24 w-40 items-center justify-center rounded-lg bg-black/10 text-[11px] text-dim">…</div>;
  }
  return (
    <button type="button" onClick={download} className={cn('mb-1 flex items-center gap-2 rounded-lg px-2.5 py-2 text-left', mine ? 'bg-white/15' : 'bg-panel')}>
      <FileText className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-xs">{m.attachmentName}</span>
      <Download className="h-3.5 w-3.5 shrink-0 opacity-70" />
    </button>
  );
}

function NewConversation({ onCreated, onlineSet, t }: { onCreated: (c: ChatConversationResponse) => void; onlineSet: Set<number>; t: ReturnType<typeof useTranslations> }) {
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
        {isGroup && <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={t('groupNamePlaceholder')} />}
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
                  <span className="relative shrink-0">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-panel-2 text-xs font-bold text-muted">{initials(u.name)}</span>
                    <OnlineDot online={onlineSet.has(u.id)} />
                  </span>
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
