'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, X, Plus, ArrowLeft, Send, Users, Search, Check, CheckCheck,
  Pencil, Trash2, Paperclip, Download, FileText, Smile, Settings2, UserPlus, LogOut, UserMinus,
} from 'lucide-react';

/** Emojis curados (sem dependência externa) para o seletor do compositor. */
const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😎', '🤩', '🤔',
  '😅', '😴', '😉', '🙂', '😬', '😳', '🥳', '😢', '😭', '😡',
  '👍', '👎', '👏', '🙏', '💪', '🙌', '🤝', '✌️', '🤙', '👀',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🔥', '✨', '🎉', '⭐',
  '✅', '❌', '⚠️', '💡', '📌', '📎', '💬', '🚀', '🐛', '⏰',
];
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
  const [view, setView] = useState<'list' | 'thread' | 'new' | 'manage'>('list');
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
      // Se a thread está aberta na conversa que recebeu, marca como lida na hora.
      const convId = Number(payload?.conversationId);
      if (ev === 'chat.message' && open && convId === activeId) {
        chatApi.markRead(convId).then(() => qc.invalidateQueries({ queryKey: ['chat', 'unread'] })).catch(() => {});
      }
    } else if (ev === 'chat.read') {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
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
      {/* Botão flutuante (FAB) — some quando o painel está aberto. */}
      {!open && (
        <button
          type="button"
          onClick={() => { setOpen(true); setView('list'); }}
          className="fixed bottom-5 right-5 z-[70] grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-fg shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
          aria-label={t('title')}
          title={t('title')}
        >
          <MessageSquare className="h-6 w-6" aria-hidden />
          {unreadTotal > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-panel">
              {unreadTotal > 9 ? '9+' : unreadTotal}
            </span>
          )}
        </button>
      )}

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[80] flex" role="dialog" aria-modal="true" aria-label={t('title')}>
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setOpen(false)} aria-hidden />
            <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-panel shadow-2xl animate-slide-in">
            <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-gradient-to-r from-primary/8 to-transparent px-4">
              {view !== 'list' ? (
                <button type="button" onClick={() => setView(view === 'manage' ? 'thread' : 'list')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('back')}>
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><MessageSquare className="h-4 w-4" /></span>
              )}
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-text">
                {view === 'thread' ? (activeConv?.name ?? t('title')) : view === 'new' ? t('newConversation') : view === 'manage' ? t('manageGroup') : t('title')}
              </p>
              {view === 'list' && (
                <button type="button" onClick={() => setView('new')} className="grid h-8 w-8 place-items-center rounded-lg text-primary hover:bg-primary/10" aria-label={t('newConversation')} title={t('newConversation')}>
                  <Plus className="h-4 w-4" />
                </button>
              )}
              {view === 'thread' && activeConv?.isGroup && (
                <button type="button" onClick={() => setView('manage')} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('manageGroup')} title={t('manageGroup')}>
                  <Settings2 className="h-4 w-4" />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text" aria-label={t('close')}>
                <X className="h-4 w-4" />
              </button>
            </header>

            {view === 'list' && <ConversationList data={conversations.data} loading={conversations.isLoading} onlineSet={onlineSet} onOpen={openConversation} onNew={() => setView('new')} t={t} />}
            {view === 'thread' && activeId != null && <Thread conversationId={activeId} conv={activeConv} typingName={typingByConv[activeId]} t={t} />}
            {view === 'new' && <NewConversation t={t} onlineSet={onlineSet} onCreated={(c) => openConversation(c.id)} />}
            {view === 'manage' && activeConv && <ManageGroup conv={activeConv} onlineSet={onlineSet} onLeft={() => { setView('list'); setActiveId(null); }} t={t} />}
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
    <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
      {data.map((c) => {
        const other = c.isGroup ? null : c.participants.find((p) => p.userId !== meId);
        const online = other ? onlineSet.has(other.userId) : false;
        const unread = c.unreadCount > 0;
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onOpen(c.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-panel-2/60">
              <span className="relative shrink-0">
                <span className={cn('grid h-11 w-11 place-items-center rounded-full text-sm font-bold', c.isGroup ? 'bg-gradient-to-br from-primary/25 to-primary/10 text-primary' : 'bg-gradient-to-br from-panel-2 to-bg-subtle text-muted ring-1 ring-border')}>
                  {c.isGroup ? <Users className="h-5 w-5" /> : initials(c.name)}
                </span>
                {!c.isGroup && <OnlineDot online={online} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cn('truncate text-sm', unread ? 'font-bold text-text' : 'font-semibold text-text')}>{c.name}</span>
                  {c.lastMessageAt && <span className={cn('ml-auto shrink-0 text-[10px]', unread ? 'font-semibold text-primary' : 'text-dim')}>{relTime(c.lastMessageAt)}</span>}
                </span>
                <span className={cn('mt-0.5 block truncate text-xs', unread ? 'text-text' : 'text-muted')}>{c.lastMessage ?? t('threadEmpty')}</span>
              </span>
              {unread && (
                <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-fg">{c.unreadCount > 99 ? '99+' : c.unreadCount}</span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Data relativa curta (hoje → hora; ontem; senão data). */
function relTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yst = new Date(now); yst.setDate(now.getDate() - 1);
  if (d.toDateString() === yst.toDateString()) return '·';
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}

function Thread({ conversationId, conv, typingName, t }: { conversationId: number; conv: ChatConversationResponse | null; typingName?: string; t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [editing, setEditing] = useState<{ id: number; body: string } | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastTyping = useRef(0);

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => { el?.focus(); const pos = start + emoji.length; el?.setSelectionRange(pos, pos); });
  };

  const messages = useQuery({
    queryKey: ['chat', 'messages', conversationId],
    queryFn: () => chatApi.messages(conversationId),
    retry: false,
  });

  // Recibo de leitura: id da minha última mensagem + quem já leu.
  const myLastId = useMemo(() => {
    const arr = messages.data ?? [];
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].senderId === meId) return arr[i].id;
    return null;
  }, [messages.data, meId]);
  const others = (conv?.participants ?? []).filter((p) => p.userId !== meId);
  const renderReceipt = (createdAt: string) => {
    const seen = others.filter((p) => p.lastReadAt && new Date(p.lastReadAt) >= new Date(createdAt));
    if (seen.length === 0) {
      return <span className="flex items-center gap-0.5"><Check className="h-3 w-3" /> {t('sent')}</span>;
    }
    const label = conv?.isGroup ? t('seenByCount', { count: seen.length }) : t('seen');
    return <span className="flex items-center gap-0.5 font-medium"><CheckCheck className="h-3 w-3" /> {label}</span>;
  };

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
      <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto bg-bg-subtle/40 p-4">
        {messages.isLoading ? (
          <LoadingState />
        ) : (messages.data?.length ?? 0) === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary/10 text-primary"><MessageSquare className="h-5 w-5" /></span>
            <p className="text-sm text-dim">{t('threadEmpty')}</p>
          </div>
        ) : (
          messages.data!.map((m, i) => {
            const arr = messages.data!;
            const prev = arr[i - 1];
            const mine = m.senderId === meId;
            const sameDay = prev && new Date(prev.createdAt).toDateString() === new Date(m.createdAt).toDateString();
            // Primeiro de um grupo: remetente ou dia diferente, ou intervalo > 5 min.
            const grouped = prev != null && prev.senderId === m.senderId && sameDay
              && (new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime()) < 5 * 60_000;
            return (
              <div key={m.id}>
                {!sameDay && <DayDivider iso={m.createdAt} t={t} />}
                <MessageBubble
                  m={m}
                  mine={mine}
                  showMeta={!grouped}
                  isGroup={conv?.isGroup ?? false}
                  editing={editing?.id === m.id ? editing.body : null}
                  onStartEdit={() => setEditing({ id: m.id, body: m.body })}
                  onChangeEdit={(v) => setEditing({ id: m.id, body: v })}
                  onSaveEdit={() => { if (editing && editing.body.trim()) edit.mutate({ id: m.id, body: editing.body.trim() }); }}
                  onCancelEdit={() => setEditing(null)}
                  onDelete={() => del.mutate(m.id)}
                  receipt={m.id === myLastId ? renderReceipt(m.createdAt) : null}
                  t={t}
                />
              </div>
            );
          })
        )}
        {typingName && (
          <div className="flex items-center gap-2 px-1 pt-1">
            <span className="flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-dim [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-dim [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-dim" />
            </span>
            <span className="text-[11px] italic text-dim">{t('typing', { name: typingName })}</span>
          </div>
        )}
      </div>

      <div className="relative flex shrink-0 items-end gap-2 border-t border-border p-3">
        {emojiOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setEmojiOpen(false)} aria-hidden />
            <div className="absolute bottom-full left-3 z-20 mb-2 w-64 rounded-xl border border-border bg-panel p-2 shadow-lg">
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJIS.map((e) => (
                  <button key={e} type="button" onClick={() => insertEmoji(e)} className="grid h-7 w-7 place-items-center rounded text-lg hover:bg-panel-2" aria-label={e}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); if (fileRef.current) fileRef.current.value = ''; }} />
        <button type="button" onClick={() => setEmojiOpen((v) => !v)} className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-panel-2 hover:text-text', emojiOpen ? 'text-primary' : 'text-muted')} aria-label={t('emoji')} title={t('emoji')}>
          <Smile className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={upload.isPending} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-panel-2 hover:text-text disabled:opacity-50" aria-label={t('attach')} title={t('attach')}>
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={inputRef}
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

/** Separador de dia (Hoje / Ontem / data) centralizado. */
function DayDivider({ iso, t }: { iso: string; t: ReturnType<typeof useTranslations> }) {
  const d = new Date(iso);
  const now = new Date();
  const yst = new Date(now); yst.setDate(now.getDate() - 1);
  let label: string;
  if (d.toDateString() === now.toDateString()) label = t('today');
  else if (d.toDateString() === yst.toDateString()) label = t('yesterday');
  else label = d.toLocaleDateString([], { day: '2-digit', month: 'long', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-panel-2/80 px-2.5 py-0.5 text-[10px] font-medium text-dim">{label}</span>
    </div>
  );
}

function MessageBubble({ m, mine, showMeta, isGroup, editing, onStartEdit, onChangeEdit, onSaveEdit, onCancelEdit, onDelete, receipt, t }: {
  m: ChatMessageResponse;
  mine: boolean;
  showMeta: boolean;
  isGroup: boolean;
  editing: string | null;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  receipt?: React.ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  const [confirming, setConfirming] = useState(false);
  if (editing !== null) {
    return (
      <div className="flex flex-col items-end pl-9">
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
      </div>
    );
  }
  return (
    <div className={cn('group flex items-end gap-2', mine ? 'flex-row-reverse' : 'flex-row')}>
      {/* Coluna do avatar (só para o outro); ocupa espaço mesmo quando agrupado, p/ alinhar. */}
      {!mine && (
        <span className="w-7 shrink-0 self-end">
          {showMeta && <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-panel-2 to-bg-subtle text-[10px] font-bold text-muted ring-1 ring-border">{initials(m.senderName)}</span>}
        </span>
      )}
      <div className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
        {showMeta && !mine && isGroup && <span className="mb-0.5 px-1 text-[11px] font-semibold text-primary">{m.senderName}</span>}
        <div className="flex items-end gap-1.5">
          {mine && (
            confirming ? (
              <span className="flex items-center gap-1 rounded-md bg-danger/10 px-1.5 py-0.5 text-[10px] text-danger">
                {t('confirmDelete')}
                <button type="button" onClick={() => { setConfirming(false); onDelete(); }} className="font-bold hover:underline">{t('yes')}</button>
                <button type="button" onClick={() => setConfirming(false)} className="text-dim hover:underline">{t('no')}</button>
              </span>
            ) : (
              <span className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                <button type="button" onClick={onStartEdit} className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-panel-2 hover:text-text" aria-label={t('edit')}><Pencil className="h-3 w-3" /></button>
                <button type="button" onClick={() => setConfirming(true)} className="grid h-6 w-6 place-items-center rounded text-dim hover:bg-danger/10 hover:text-danger" aria-label={t('delete')}><Trash2 className="h-3 w-3" /></button>
              </span>
            )
          )}
          <div className={cn(
            'max-w-[16rem] px-3.5 py-2 text-sm shadow-sm',
            mine
              ? cn('bg-primary text-primary-fg', showMeta ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-br-md')
              : cn('bg-panel text-text ring-1 ring-border', showMeta ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl rounded-bl-md'),
          )}>
            {m.attachmentName && <ChatAttachment m={m} mine={mine} t={t} />}
            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
            <span className={cn('mt-1 flex items-center justify-end gap-1 text-[9px]', mine ? 'text-primary-fg/70' : 'text-dim')}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {m.editedAt && <span>· {t('edited')}</span>}
              {receipt}
            </span>
          </div>
        </div>
      </div>
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

function ManageGroup({ conv, onlineSet, onLeft, t }: { conv: ChatConversationResponse; onlineSet: Set<number>; onLeft: () => void; t: ReturnType<typeof useTranslations> }) {
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState(conv.name);
  const [adding, setAdding] = useState(false);
  const [term, setTerm] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });

  const rename = useMutation({ mutationFn: () => chatApi.rename(conv.id, name.trim()), onSuccess: () => { toast.success(t('groupRenamed')); invalidate(); }, onError: (e) => toast.error(apiErrorMessage(e, t('editError'))) });
  const removeP = useMutation({ mutationFn: (uid: number) => chatApi.removeParticipant(conv.id, uid), onSuccess: invalidate, onError: (e) => toast.error(apiErrorMessage(e, t('editError'))) });
  const addP = useMutation({ mutationFn: (uid: number) => chatApi.addParticipants(conv.id, [uid]), onSuccess: invalidate, onError: (e) => toast.error(apiErrorMessage(e, t('editError'))) });
  const leave = useMutation({ mutationFn: () => chatApi.leave(conv.id), onSuccess: () => { invalidate(); onLeft(); }, onError: (e) => toast.error(apiErrorMessage(e, t('editError'))) });

  const users = useQuery({ queryKey: ['users', 'chat-picker'], queryFn: () => usersApi.list(1, 200), retry: false, enabled: adding });
  const currentIds = useMemo(() => new Set(conv.participants.map((p) => p.userId)), [conv.participants]);
  const addable = useMemo(() => {
    const q = term.trim().toLowerCase();
    return (users.data?.items ?? []).filter((u) => !currentIds.has(u.id) && (!q || u.name.toLowerCase().includes(q)));
  }, [users.data, term, currentIds]);

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-dim">{t('groupName')}</label>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => rename.mutate()} loading={rename.isPending} disabled={!name.trim() || name.trim() === conv.name}>{t('saveEdit')}</Button>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-dim">{t('members', { count: conv.participants.length })}</p>
          <Button size="sm" variant="secondary" className="gap-1" onClick={() => setAdding((a) => !a)}><UserPlus className="h-3.5 w-3.5" /> {t('addMembers')}</Button>
        </div>
        {adding && (
          <div className="mb-2 rounded-lg border border-border p-2">
            <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder={t('searchUsers')} className="mb-1.5" />
            <div className="max-h-40 overflow-y-auto">
              {addable.length === 0 ? <p className="py-3 text-center text-xs text-dim">{t('noUsers')}</p> : addable.map((u) => (
                <button key={u.id} type="button" onClick={() => addP.mutate(u.id)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-panel-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-panel-2 text-[10px] font-bold text-muted">{initials(u.name)}</span>
                  <span className="min-w-0 flex-1 truncate">{u.name}</span>
                  <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
                </button>
              ))}
            </div>
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {conv.participants.map((p) => (
            <li key={p.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
              <span className="relative shrink-0">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-panel-2 text-[10px] font-bold text-muted">{initials(p.name)}</span>
                <OnlineDot online={onlineSet.has(p.userId)} />
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-text">{p.name}{p.userId === meId && ` (${t('you')})`}</span>
              {p.userId !== meId && (
                <button type="button" onClick={() => removeP.mutate(p.userId)} className="grid h-7 w-7 place-items-center rounded text-dim hover:bg-danger/10 hover:text-danger" aria-label={t('remove')}><UserMinus className="h-4 w-4" /></button>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Button variant="secondary" className="mt-auto w-full gap-1.5 text-danger" loading={leave.isPending} onClick={() => leave.mutate()}>
        <LogOut className="h-4 w-4" /> {t('leaveGroup')}
      </Button>
    </div>
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
