'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Plus, Search, BookOpen, Clock, TrendingUp,
  FileText, ChevronRight, Eye,
} from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import type { KnowledgeAssetResponse } from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { useTabStore } from '@/features/workspace/tab-store';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

type ViewMode = 'all' | 'recent' | 'popular';

export function KnowledgeView() {
  const locale = useLocale() as Locale;
  const t = useTranslations('knowledge');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const openTab = useTabStore((s) => s.openTab);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const { data: allData, isLoading } = useQuery({
    queryKey: ['knowledge', 'list', 'wiki'],
    queryFn: () => knowledgeApi.list({ pageSize: 200 }),
  });

  const articles = allData?.items ?? [];

  const filtered = useMemo(() => {
    let list = articles;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(q) ||
          (a.summary && a.summary.toLowerCase().includes(q)),
      );
    }
    if (viewMode === 'recent') {
      list = [...list].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).slice(0, 20);
    } else if (viewMode === 'popular') {
      list = [...list].sort((a, b) => b.reuseCount - a.reuseCount).slice(0, 20);
    }
    return list;
  }, [articles, search, viewMode]);

  const published = articles.filter((a) => a.isPublished);
  const drafts = articles.filter((a) => !a.isPublished);

  const handleOpen = (article: KnowledgeAssetResponse) => {
    openTab({
      kind: 'knowledge-article',
      params: { id: article.id },
      title: article.title,
      icon: 'knowledge',
    });
  };

  const handleNew = () => {
    openTab({
      kind: 'knowledge-article',
      params: { id: 'new' },
      title: t('newArticle'),
      icon: 'knowledge',
    });
  };

  const sidebarItems: { key: ViewMode; icon: React.ElementType; label: string; count?: number }[] = [
    { key: 'all', icon: FileText, label: t('allArticles'), count: articles.length },
    { key: 'recent', icon: Clock, label: t('recentArticles') },
    { key: 'popular', icon: TrendingUp, label: t('popularArticles') },
  ];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-subtle/30">
        <div className="px-md py-md">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-bold text-text">{t('wikiTitle')}</h1>
          </div>
          <p className="text-[10px] text-muted leading-relaxed">{t('wikiSubtitle')}</p>
        </div>

        <nav className="flex flex-col gap-0.5 px-sm">
          {sidebarItems.map(({ key, icon: Icon, label, count }) => (
            <button
              key={key}
              type="button"
              onClick={() => setViewMode(key)}
              className={`flex items-center gap-2 rounded-lg px-sm py-2 text-xs font-medium transition-colors ${
                viewMode === key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:bg-panel-2 hover:text-text'
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {count != null && (
                <span className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium">{count}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-auto border-t border-border px-sm py-sm">
          <div className="flex items-center gap-2 text-[10px] text-dim px-sm">
            <Eye className="h-3 w-3" />
            <span>{published.length} {t('statusPublished').toLowerCase()}</span>
            <span className="text-border">|</span>
            <span>{drafts.length} {t('statusDraft').toLowerCase()}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Search bar */}
        <div className="flex items-center gap-md border-b border-border px-lg py-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-9 h-9 text-xs"
            />
          </div>
          {search && (
            <span className="text-xs text-muted">
              {filtered.length} {t('searchResults').toLowerCase()}
            </span>
          )}
          <div className="ml-auto">
            <Can permission="knowledge.create">
              <Button size="sm" onClick={handleNew}>
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {t('newArticle')}
              </Button>
            </Can>
          </div>
        </div>

        {/* Articles grid */}
        <div className="flex-1 overflow-y-auto p-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex items-center gap-2 text-sm text-muted">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                {t('loading')}
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <BookOpen className="h-12 w-12 mb-3 text-dim" />
              <p className="text-sm font-medium text-text">{t('noContent')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-md">
              {filtered.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => handleOpen(article)}
                  className="card-surface flex flex-col gap-2 p-md text-left transition-all hover:border-primary/30 hover:shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-text group-hover:text-primary transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <ChevronRight className="h-4 w-4 shrink-0 text-dim group-hover:text-primary transition-colors mt-0.5" />
                  </div>

                  {article.summary && (
                    <p className="text-xs text-muted line-clamp-2 leading-relaxed">{article.summary}</p>
                  )}

                  <div className="mt-auto flex items-center gap-3 pt-2 text-[10px] text-dim">
                    <span className={
                      article.isPublished
                        ? 'inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }>
                      {article.isPublished ? t('statusPublished') : t('statusDraft')}
                    </span>
                    {article.reuseCount > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-2.5 w-2.5" />
                        {article.reuseCount}
                      </span>
                    )}
                    {article.updatedAt && (
                      <span className="ml-auto">
                        {formatDateTime(article.updatedAt, { locale, timeZone })}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
