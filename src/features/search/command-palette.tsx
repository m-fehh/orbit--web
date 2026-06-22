'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Command } from 'cmdk';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  Search, FileText, BookOpen, GitBranch, Wrench, Loader2,
  Plus, LayoutDashboard, Settings, Users, BarChart3, Bell,
  LogOut, Moon, Sun, Tag, Brain, Zap, ArrowRight, Clock,
  Inbox, Shield,
} from 'lucide-react';
import { searchApi } from '@/shared/api/endpoints';
import type { SearchResultItem, SearchResultType } from '@/shared/api/types';
import { Portal } from '@/shared/ui/portal';
import { useAuthStore } from '@/features/auth/auth-store';
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

const TYPE_ROUTES: Record<SearchResultType, (id: number) => string> = {
  ticket: (id) => `/tickets/${id}`,
  knowledge: (id) => `/knowledge/${id}`,
  rootcause: (id) => `/root-causes/${id}`,
  resolution: (id) => `/resolutions/${id}`,
};

const TYPE_COLORS: Record<SearchResultType, string> = {
  ticket: 'text-primary',
  knowledge: 'text-warning',
  rootcause: 'text-danger',
  resolution: 'text-success',
};

// ---------------------------------------------------------------------------
// Navigation Actions
// ---------------------------------------------------------------------------

interface QuickAction {
  id: string;
  label: string;
  icon: typeof FileText;
  shortcut?: string;
  section: 'navigation' | 'actions' | 'settings';
  action: (router: ReturnType<typeof useRouter>) => void;
}

const ACTIONS: QuickAction[] = [
  { id: 'nav-dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'navigation', action: (r) => r.push('/workspace') },
  { id: 'nav-tickets', label: 'Tickets', icon: FileText, section: 'navigation', action: (r) => r.push('/workspace') },
  { id: 'nav-knowledge', label: 'Knowledge Base', icon: BookOpen, section: 'navigation', action: (r) => r.push('/knowledge') },
  { id: 'nav-analytics', label: 'Analytics', icon: BarChart3, section: 'navigation', action: (r) => r.push('/analytics') },
  { id: 'nav-admin', label: 'Admin', icon: Shield, section: 'navigation', action: (r) => r.push('/workspace') },
  { id: 'nav-tags', label: 'Tags', icon: Tag, section: 'navigation', action: (r) => r.push('/tags') },
  { id: 'nav-iterations', label: 'Iterations', icon: Clock, section: 'navigation', action: (r) => r.push('/iterations') },
  { id: 'act-new-ticket', label: 'Create new ticket', icon: Plus, shortcut: 'N', section: 'actions', action: () => {} },
  { id: 'act-intelligence', label: 'Intelligence Center', icon: Brain, section: 'actions', action: (r) => r.push('/workspace') },
  { id: 'set-settings', label: 'Settings', icon: Settings, section: 'settings', action: (r) => r.push('/settings') },
  { id: 'set-notifications', label: 'Notifications', icon: Bell, section: 'settings', action: (r) => r.push('/settings') },
];

// ---------------------------------------------------------------------------
// Recent items (localStorage)
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
// Command Palette Component
// ---------------------------------------------------------------------------

export function CommandPalette() {
  const t = useTranslations('search');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

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
    if (!open) { setTerm(''); setDebounced(''); }
  }, [open]);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(id);
  }, [term]);

  const enabled = debounced.length >= 2;
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

  const goToResult = useCallback((item: SearchResultItem) => {
    addRecent({ type: item.type, id: item.id, title: item.title, timestamp: Date.now() });
    setOpen(false);
    router.push(TYPE_ROUTES[item.type](item.id));
  }, [router]);

  const runAction = useCallback((action: QuickAction) => {
    setOpen(false);
    action.action(router);
  }, [router]);

  const showSearch = enabled;
  const showRecent = !showSearch && recent.length > 0;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xl items-center gap-sm rounded-md border border-border bg-bg-subtle px-md text-sm text-dim transition-all hover:border-border-strong hover:bg-panel hover:shadow-sm"
      >
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex-1 truncate text-left">{t('placeholder')}</span>
        <kbd className="hidden shrink-0 rounded border border-border bg-bg-subtle px-1.5 text-[10px] font-medium text-dim sm:inline">
          Ctrl K
        </kbd>
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <Portal>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-[60] flex items-start justify-center bg-black/60 p-md pt-[10vh] backdrop-blur-sm"
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
                    {isFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
                    ) : (
                      <Search className="h-4 w-4 text-dim" aria-hidden />
                    )}
                    <Command.Input
                      ref={inputRef}
                      value={term}
                      onValueChange={setTerm}
                      placeholder={t('placeholder')}
                      className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
                      autoFocus
                    />
                    <kbd className="rounded border border-border bg-bg-subtle px-1.5 text-[10px] text-dim">ESC</kbd>
                  </div>

                  <Command.List className="max-h-[50vh] overflow-y-auto p-sm">
                    <Command.Empty className="px-md py-lg text-center text-sm text-dim">
                      {enabled ? t('noResults', { q: debounced }) : t('typeToSearch')}
                    </Command.Empty>

                    {/* Recent */}
                    {showRecent && (
                      <Command.Group heading={
                        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                          <Clock className="h-3 w-3" /> Recent
                        </span>
                      }>
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
                              <ArrowRight className="h-3 w-3 text-dim opacity-0 group-aria-selected:opacity-100" />
                            </Command.Item>
                          );
                        })}
                      </Command.Group>
                    )}

                    {/* Search Results */}
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
                                {item.snippet && (
                                  <span className="block truncate text-xs text-muted">{item.snippet}</span>
                                )}
                              </span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      );
                    })}

                    {/* Quick Actions (when not searching) */}
                    {!showSearch && (
                      <>
                        <Command.Group heading={
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                            <Zap className="h-3 w-3" /> Actions
                          </span>
                        }>
                          {ACTIONS.filter((a) => a.section === 'actions').map((a) => (
                            <Command.Item
                              key={a.id}
                              value={a.label}
                              onSelect={() => runAction(a)}
                              className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                            >
                              <a.icon className="h-4 w-4 text-primary" />
                              <span className="flex-1">{a.label}</span>
                              {a.shortcut && (
                                <kbd className="rounded border border-border bg-bg-subtle px-1.5 text-[10px] text-dim">{a.shortcut}</kbd>
                              )}
                            </Command.Item>
                          ))}
                        </Command.Group>

                        <Command.Group heading={
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                            <ArrowRight className="h-3 w-3" /> Navigation
                          </span>
                        }>
                          {ACTIONS.filter((a) => a.section === 'navigation').map((a) => (
                            <Command.Item
                              key={a.id}
                              value={a.label}
                              onSelect={() => runAction(a)}
                              className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                            >
                              <a.icon className="h-4 w-4 text-dim" />
                              <span className="flex-1">{a.label}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>

                        <Command.Group heading={
                          <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                            <Settings className="h-3 w-3" /> Settings
                          </span>
                        }>
                          {ACTIONS.filter((a) => a.section === 'settings').map((a) => (
                            <Command.Item
                              key={a.id}
                              value={a.label}
                              onSelect={() => runAction(a)}
                              className="flex cursor-pointer items-center gap-sm rounded-md px-md py-sm text-sm aria-selected:bg-primary/10"
                            >
                              <a.icon className="h-4 w-4 text-dim" />
                              <span className="flex-1">{a.label}</span>
                            </Command.Item>
                          ))}
                        </Command.Group>
                      </>
                    )}
                  </Command.List>

                  {/* Footer */}
                  <div className="flex items-center gap-md border-t border-border px-md py-1.5 text-[10px] text-dim">
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border bg-bg-subtle px-1">↑↓</kbd> navigate
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border bg-bg-subtle px-1">↵</kbd> select
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className="rounded border border-border bg-bg-subtle px-1">esc</kbd> close
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      <Brain className="h-3 w-3 text-primary" /> Orbit Intelligence
                    </span>
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
