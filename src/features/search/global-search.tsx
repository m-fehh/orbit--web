'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, FileText, BookOpen, GitBranch, Wrench, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from '@/shared/api/endpoints';
import type { SearchResultItem, SearchResultType } from '@/shared/api/types';
import { cn } from '@/shared/lib/utils';

const ICONS: Record<SearchResultType, typeof FileText> = {
  ticket: FileText,
  knowledge: BookOpen,
  rootcause: GitBranch,
  resolution: Wrench,
};

const ROUTES: Record<SearchResultType, (id: number) => string> = {
  ticket: (id) => `/tickets/${id}`,
  knowledge: (id) => `/knowledge/${id}`,
  rootcause: (id) => `/root-causes/${id}`,
  resolution: (id) => `/resolutions/${id}`,
};

/** Busca global agrupada (abre com Ctrl+K ou pelo header). */
export function GlobalSearch() {
  const t = useTranslations('search');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Atalho global Ctrl+K / Cmd+K.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
    else {
      setTerm('');
      setDebounced('');
    }
  }, [open]);

  // Debounce 200ms.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(term.trim()), 200);
    return () => clearTimeout(id);
  }, [term]);

  const enabled = debounced.length >= 2;
  const { data, isFetching } = useQuery({
    queryKey: ['global-search', debounced],
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

  function go(item: SearchResultItem) {
    setOpen(false);
    router.push(ROUTES[item.type](item.id));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-sm items-center gap-sm rounded border border-border bg-bg-subtle px-md text-sm text-dim hover:border-border-strong"
      >
        <Search className="h-4 w-4" aria-hidden />
        <span className="flex-1 text-left">{t('placeholder')}</span>
        <kbd className="rounded border border-border px-1.5 text-xs">Ctrl K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-md pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-panel shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-sm border-b border-border px-md">
              {isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin text-dim" aria-hidden />
              ) : (
                <Search className="h-4 w-4 text-dim" aria-hidden />
              )}
              <input
                ref={inputRef}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder={t('placeholder')}
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
              />
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-sm">
              {!enabled && <p className="px-md py-lg text-sm text-dim">{t('minChars')}</p>}
              {enabled && !isFetching && (data?.results.length ?? 0) === 0 && (
                <p className="px-md py-lg text-sm text-dim">{t('noResults', { q: debounced })}</p>
              )}
              {Object.entries(grouped).map(([type, items]) => {
                const Icon = ICONS[type as SearchResultType];
                return (
                  <div key={type} className="mb-sm">
                    <p className="px-md py-1 text-xs font-semibold uppercase tracking-wide text-dim">
                      {t(`groups.${type}` as 'groups.ticket')}
                    </p>
                    {items.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        type="button"
                        onClick={() => go(item)}
                        className={cn(
                          'flex w-full items-start gap-sm rounded px-md py-sm text-left hover:bg-panel-2',
                        )}
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-text">{item.title}</span>
                          {item.snippet && (
                            <span className="block truncate text-xs text-muted">{item.snippet}</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
