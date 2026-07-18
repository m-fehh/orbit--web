'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Search, FileText, BookOpen, GitBranch, Wrench, Loader2,
  Plus, LayoutDashboard, Settings, Users, BarChart3,
  Moon, Tag, Brain, Zap, ArrowRight, ArrowLeft, Clock,
  Shield, Repeat, Gauge, CircleDot, UserCheck, ChevronRight,
} from 'lucide-react';
import { searchApi, ticketsApi } from '@/shared/api/endpoints';
import { apiErrorMessage, type SearchResultItem, type SearchResultType, type TicketStatusValue, type TicketStatusName } from '@/shared/api/types';
import { Portal } from '@/shared/ui/portal';
import { useAuthStore } from '@/features/auth/auth-store';
import { useUiStore } from '@/features/shell/ui-store';
import { useTabStore, type TabLocation, type ViewKind, type IconKey } from '@/features/workspace/tab-store';
import { openNewTicketWindow } from '@/features/tickets/ticket-actions';
import { useEnumOptions } from '@/shared/enums';
import { StatusBadge } from '@/features/tickets/badges';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Icons & Routes
// ---------------------------------------------------------------------------

const TYPE_ICONS: Record<SearchResultType, typeof FileText> = {
  ticket: FileText,
  knowledge: BookOpen,
  rootcause: GitBranch,
  resolution: Wrench,
};

const TYPE_COLORS: Record<SearchResultType, string> = {
  ticket: 'text-primary',
  knowledge: 'text-warning',
  rootcause: 'text-danger',
  resolution: 'text-success',
};

// ---------------------------------------------------------------------------
// Navegação (modelo de abas do workspace)
// ---------------------------------------------------------------------------

interface NavItem {
  kind: ViewKind;
  icon: IconKey;
  navKey: string; // chave no namespace 'nav'
  Icon: typeof FileText;
}

const NAV: NavItem[] = [
  { kind: 'dashboard', icon: 'dashboard', navKey: 'dashboard', Icon: LayoutDashboard },
  { kind: 'tickets', icon: 'tickets', navKey: 'tickets', Icon: FileText },
  { kind: 'investigations', icon: 'search', navKey: 'investigations', Icon: GitBranch },
  { kind: 'intelligence', icon: 'analytics', navKey: 'intelligence', Icon: Brain },
  { kind: 'playbooks', icon: 'knowledge', navKey: 'playbooks', Icon: BookOpen },
  { kind: 'problems', icon: 'analytics', navKey: 'problems', Icon: Repeat },
  { kind: 'analytics', icon: 'analytics', navKey: 'analytics', Icon: BarChart3 },
  { kind: 'performance', icon: 'analytics', navKey: 'performance', Icon: Gauge },
  { kind: 'iterations', icon: 'analytics', navKey: 'iterations', Icon: Clock },
  { kind: 'tags', icon: 'analytics', navKey: 'tags', Icon: Tag },
  { kind: 'users', icon: 'users', navKey: 'users', Icon: Users },
  { kind: 'admin', icon: 'admin', navKey: 'admin', Icon: Shield },
  { kind: 'settings', icon: 'admin', navKey: 'settings', Icon: Settings },
];

// ---------------------------------------------------------------------------
// Recentes (localStorage)
// ---------------------------------------------------------------------------

const RECENT_KEY = 'orbit_cmd_recent';
const MAX_RECENT = 5;

interface RecentItem {
  type: SearchResultType;
  id: number;
  title: string;
  timestamp: number;
}

function getRecent(): RecentItem[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch { return []; }
}

function addRecent(item: RecentItem) {
  const list = getRecent().filter((r) => !(r.type === item.type && r.id === item.id));
  list.unshift({ ...item, timestamp: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

// ---------------------------------------------------------------------------
// Command Palette
// ---------------------------------------------------------------------------

type Page = 'root' | 'status';

export function CommandPalette() {
  const t = useTranslations('search');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState<Page>('root');
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const meId = useAuthStore((s) => s.user?.id);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const statusOptions = useEnumOptions('ticketStatus');

  // Ticket em foco: aba ativa do tipo 'ticket'.
  const activeTicketId = useTabStore((s) => {
    const tab = s.tabs.find((x) => x.id === s.activeId);
    const loc = tab?.history[tab.index];
    return loc?.kind === 'ticket' ? Number(loc.params.id) : null;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!open) { setTerm(''); setDebounced(''); setPage('root'); }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(id);
  }, [term]);

  const enabled = debounced.length >= 2 && page === 'root';
  const { data, isFetching } = useQuery({
    queryKey: ['cmd-search', debounced],
    queryFn: () => searchApi.search(debounced),
    enabled,
  });

  const grouped = useMemo(() => {
    const groups: Record<string, SearchResultItem[]> = {};
    for (const item of data?.results ?? []) {
      (groups[item.type] ??= []).push(item);
    }
    return groups;
  }, [data]);

  const recent = useMemo(() => (open ? getRecent() : []), [open]);

  const changeStatus = useMutation({
    mutationFn: (v: { id: number; status: TicketStatusValue }) => ticketsApi.changeStatus(v.id, v.status),
    onSuccess: () => { toast.success(t('statusChanged')); qc.invalidateQueries({ queryKey: ['ticket'] }); qc.invalidateQueries({ queryKey: ['tickets'] }); },
    onError: (e) => toast.error(apiErrorMessage(e, t('actionError'))),
  });
  const assignSelf = useMutation({
    mutationFn: (id: number) => ticketsApi.assign(id, meId!),
    onSuccess: () => { toast.success(t('assignedToMe')); qc.invalidateQueries({ queryKey: ['ticket'] }); qc.invalidateQueries({ queryKey: ['tickets'] }); },
    onError: (e) => toast.error(apiErrorMessage(e, t('actionError'))),
  });

  const navTo = useCallback((n: NavItem) => {
    setOpen(false);
    const loc: TabLocation = { kind: n.kind, params: {}, title: tNav(n.navKey), icon: n.icon };
    useTabStore.getState().openTab(loc);
    router.push('/workspace');
  }, [router, tNav]);

  const openTicket = useCallback((id: number, title: string) => {
    setOpen(false);
    useTabStore.getState().openTab({ kind: 'ticket', params: { id }, title: title.length > 24 ? `${title.slice(0, 24)}…` : title, icon: 'ticket' });
    router.push('/workspace');
  }, [router]);

  const goToResult = useCallback((item: SearchResultItem) => {
    addRecent({ type: item.type, id: item.id, title: item.title, timestamp: Date.now() });
    if (item.type === 'ticket') { openTicket(item.id, item.title); return; }
    setOpen(false);
    router.push(item.type === 'knowledge' ? `/knowledge/${item.id}` : item.type === 'rootcause' ? `/root-causes/${item.id}` : `/resolutions/${item.id}`);
  }, [router, openTicket]);

  const showSearch = enabled;
  const showRecent = page === 'root' && !showSearch && recent.length > 0;

  const sectionHeading = (label: string, Icon: typeof FileText) => (
    <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
      <Icon className="h-3 w-3" /> {label}
    </span>
  );

  return (
    <>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xl items-center gap-sm rounded-md border border-border bg-bg-subtle px-md text-sm text-dim transition-all hover:border-border-strong hover:bg-panel hover:shadow-sm"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{t('placeholder')}</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-bg-subtle px-1.5 text-[10px] font-medium text-dim sm:inline">Ctrl K</kbd>
      </button>

      <AnimatePresence>
        {open && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[60] flex items-start justify-center bg-black/50 p-md pt-[10vh] backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -8 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-panel shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <Command shouldFilter={!showSearch} loop>
                  {/* Input */}
                  <div className="flex items-center gap-sm border-b border-border px-md">
                    {page === 'status' ? (
                      <button type="button" onClick={() => { setPage('root'); setTerm(''); inputRef.current?.focus(); }} className="grid h-6 w-6 shrink-0 place-items-center rounded text-dim hover:text-text" aria-label={t('backToCommands')}>
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                    ) : isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                    ) : (
                      <Search className="h-4 w-4 text-dim" aria-hidden />
                    )}
                    <Command.Input
                      ref={inputRef}
                      value={term}
                      onValueChange={setTerm}
                      placeholder={page === 'status' ? t('pickStatus') : t('placeholder')}
                      className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
                      autoFocus
                    />
                    <kbd className="rounded border border-border bg-bg-subtle px-1.5 text-[10px] text-dim">ESC</kbd>
                  </div>

                  <Command.List className="max-h-[52vh] overflow-y-auto p-sm">
                    <Command.Empty className="px-md py-lg text-center text-sm text-dim">
                      {enabled ? t('noResults', { q: debounced }) : t('typeToSearch')}
                    </Command.Empty>

                    {/* ── Página: escolher status ── */}
                    {page === 'status' && activeTicketId != null && (
                      <Command.Group heading={sectionHeading(t('pickStatus'), CircleDot)}>
                        {statusOptions.map((o) => (
                          <Command.Item
                            key={o.value}
                            value={o.label}
                            onSelect={() => { changeStatus.mutate({ id: activeTicketId, status: o.value as TicketStatusValue }); setOpen(false); }}
                            className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                          >
                            <StatusBadge status={o.name as TicketStatusName} />
                            <span className="flex-1" />
                          </Command.Item>
                        ))}
                      </Command.Group>
                    )}

                    {/* ── Página raiz ── */}
                    {page === 'root' && (
                      <>
                        {/* Recentes */}
                        {showRecent && (
                          <Command.Group heading={sectionHeading(t('secRecent'), Clock)}>
                            {recent.map((r) => {
                              const Icon = TYPE_ICONS[r.type];
                              return (
                                <Command.Item
                                  key={`recent-${r.type}-${r.id}`}
                                  value={`recent ${r.title}`}
                                  onSelect={() => goToResult({ type: r.type, id: r.id, title: r.title, snippet: '', reference: null })}
                                  className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                                >
                                  <Icon className={cn('h-4 w-4', TYPE_COLORS[r.type])} />
                                  <span className="flex-1 truncate">{r.title}</span>
                                  <ArrowRight className="h-3 w-3 text-dim" />
                                </Command.Item>
                              );
                            })}
                          </Command.Group>
                        )}

                        {/* Resultados de busca */}
                        {showSearch && Object.entries(grouped).map(([type, items]) => {
                          const Icon = TYPE_ICONS[type as SearchResultType];
                          return (
                            <Command.Group
                              key={type}
                              heading={
                                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                                  <Icon className={cn('h-3 w-3', TYPE_COLORS[type as SearchResultType])} />
                                  {t(`groups.${type}` as 'groups.ticket')}
                                  <span className="ml-auto text-[10px] font-normal">{items.length}</span>
                                </span>
                              }
                            >
                              {items.map((item) => (
                                <Command.Item
                                  key={`${item.type}-${item.id}`}
                                  value={`${item.type} ${item.title} ${item.snippet || ''}`}
                                  onSelect={() => goToResult(item)}
                                  className="flex cursor-pointer items-start gap-sm rounded-md px-md py-sm aria-selected:bg-primary/10"
                                >
                                  <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TYPE_COLORS[type as SearchResultType])} />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-text">{item.title}</span>
                                    {item.snippet && <span className="block truncate text-xs text-muted">{item.snippet}</span>}
                                  </span>
                                </Command.Item>
                              ))}
                            </Command.Group>
                          );
                        })}

                        {/* Ações + navegação (quando não está buscando) */}
                        {!showSearch && (
                          <>
                            <Command.Group heading={sectionHeading(t('secActions'), Zap)}>
                              <Command.Item value={t('createTicket')} onSelect={() => { setOpen(false); openNewTicketWindow(); }} className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10">
                                <Plus className="h-4 w-4 text-primary" />
                                <span className="flex-1">{t('createTicket')}</span>
                                <kbd className="rounded border border-border bg-bg-subtle px-1.5 text-[10px] text-dim">N</kbd>
                              </Command.Item>
                              <Command.Item value={t('toggleTheme')} onSelect={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); }} className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10">
                                <Moon className="h-4 w-4 text-dim" />
                                <span className="flex-1">{t('toggleTheme')}</span>
                              </Command.Item>
                            </Command.Group>

                            {/* Ações do ticket em foco */}
                            {activeTicketId != null && (
                              <Command.Group heading={sectionHeading(t('secTicket'), FileText)}>
                                <Command.Item value={t('changeStatus')} onSelect={() => { setTerm(''); setPage('status'); }} className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10">
                                  <CircleDot className="h-4 w-4 text-primary" />
                                  <span className="flex-1">{t('changeStatus')}</span>
                                  <ChevronRight className="h-3.5 w-3.5 text-dim" />
                                </Command.Item>
                                {meId != null && (
                                  <Command.Item value={t('assignToMe')} onSelect={() => { assignSelf.mutate(activeTicketId); setOpen(false); }} className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10">
                                    <UserCheck className="h-4 w-4 text-primary" />
                                    <span className="flex-1">{t('assignToMe')}</span>
                                  </Command.Item>
                                )}
                              </Command.Group>
                            )}

                            <Command.Group heading={sectionHeading(t('secNavigation'), ArrowRight)}>
                              {NAV.map((n) => (
                                <Command.Item
                                  key={n.kind}
                                  value={`${tNav(n.navKey)} ${n.kind}`}
                                  onSelect={() => navTo(n)}
                                  className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                                >
                                  <n.Icon className="h-4 w-4 text-dim" />
                                  <span className="flex-1">{tNav(n.navKey)}</span>
                                </Command.Item>
                              ))}
                            </Command.Group>
                          </>
                        )}
                      </>
                    )}
                  </Command.List>

                  {/* Footer */}
                  <div className="flex items-center gap-md border-t border-border px-md py-1.5 text-[10px] text-dim">
                    <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-bg-subtle px-1">↑↓</kbd> {t('footNavigate')}</span>
                    <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-bg-subtle px-1">↵</kbd> {t('footSelect')}</span>
                    <span className="flex items-center gap-1"><kbd className="rounded border border-border bg-bg-subtle px-1">esc</kbd> {t('footClose')}</span>
                    <span className="ml-auto flex items-center gap-1"><Brain className="h-3 w-3 text-primary" /> Orbit Intelligence</span>
                  </div>
                </Command>
              </motion.div>
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </>
  );
}
