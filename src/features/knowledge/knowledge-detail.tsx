'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil, ThumbsUp, BookOpen, ArrowLeft, Clock,
  TrendingUp, Target,
} from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { useTabStore } from '@/features/workspace/tab-store';
import { Button } from '@/shared/ui/button';

function extractHeadings(html: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  const re = /<h([1-3])[^>]*>(.*?)<\/h[1-3]>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]*>/g, '').trim();
    if (text) {
      headings.push({
        level: parseInt(match[1]),
        text,
        id: text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      });
    }
  }
  return headings;
}

function injectHeadingIds(html: string): string {
  return html.replace(/<h([1-3])([^>]*)>(.*?)<\/h[1-3]>/gi, (_match, level, attrs, content) => {
    const text = content.replace(/<[^>]*>/g, '').trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
  });
}

interface KnowledgeDetailProps {
  id: number;
}

export function KnowledgeDetail({ id }: KnowledgeDetailProps) {
  const t = useTranslations('knowledge');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const queryClient = useQueryClient();
  const openTab = useTabStore((s) => s.openTab);

  const { data: article, isLoading } = useQuery({
    queryKey: ['knowledge', 'detail', id],
    queryFn: () => knowledgeApi.get(id),
  });

  const { data: relatedData } = useQuery({
    queryKey: ['knowledge', 'list', 'related', article?.rootCauseId],
    queryFn: () => knowledgeApi.list({ pageSize: 5 }),
    enabled: !!article,
  });

  const reuseMutation = useMutation({
    mutationFn: () => knowledgeApi.incrementReuse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'detail', id] });
    },
  });

  const headings = useMemo(
    () => (article?.content ? extractHeadings(article.content) : []),
    [article?.content],
  );

  const contentWithIds = useMemo(
    () => (article?.content ? injectHeadingIds(article.content) : ''),
    [article?.content],
  );

  const relatedArticles = useMemo(() => {
    if (!relatedData?.items || !article) return [];
    return relatedData.items.filter((a) => a.id !== article.id).slice(0, 4);
  }, [relatedData, article]);

  if (isLoading || !article) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          {t('loading')}
        </div>
      </div>
    );
  }

  const handleEdit = () => {
    openTab({
      kind: 'knowledge-article',
      params: { id: article.id, mode: 'edit' },
      title: article.title,
      icon: 'knowledge',
    });
  };

  const handleBack = () => {
    openTab({ kind: 'knowledge', params: {}, title: t('wikiTitle'), icon: 'knowledge' });
  };

  return (
    <div className="flex h-full">
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        {/* Header */}
        <div className="border-b border-border px-lg py-md">
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={handleBack} className="flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors">
              <ArrowLeft className="h-3 w-3" />
              {t('backToList')}
            </button>
          </div>
          <div className="flex items-start justify-between gap-md">
            <div className="flex-1">
              <h1 className="text-xl font-bold">{article.title}</h1>
              {article.summary && (
                <p className="mt-2 text-sm text-muted leading-relaxed">{article.summary}</p>
              )}
            </div>
            <div className="flex items-center gap-sm shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => reuseMutation.mutate()}
                disabled={reuseMutation.isPending}
              >
                <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                {t('useKnowledge')}
              </Button>
              <Button size="sm" onClick={handleEdit}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {t('edit')}
              </Button>
            </div>
          </div>
        </div>

        {/* Metadata bar */}
        <div className="flex flex-wrap items-center gap-lg border-b border-border px-lg py-sm text-xs text-muted">
          {article.isPublished && (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('statusPublished')}
            </span>
          )}
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" aria-hidden />
            {t('reuseCount')}: {article.reuseCount}
          </span>
          {article.rootCauseId && (
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3" aria-hidden />
              {t('rootCause')}: #{article.rootCauseId}
            </span>
          )}
          {article.updatedAt && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden />
              {t('updatedAt')}: {formatDateTime(article.updatedAt, { locale, timeZone })}
            </span>
          )}
        </div>

        {/* Article content */}
        <div className="flex-1 px-lg py-md max-w-4xl">
          <div
            className="prose-orbit text-sm leading-relaxed [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-4 [&_h3]:mb-1.5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:mb-2 [&_li]:mb-1 [&_code]:bg-panel-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-panel-2 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-muted [&_a]:text-primary [&_a]:underline [&_img]:rounded-lg [&_img]:max-w-full [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-border [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-panel-2 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1.5 [&_td]:text-xs"
            dangerouslySetInnerHTML={{ __html: contentWithIds }}
          />
        </div>

        {/* Related articles */}
        {relatedArticles.length > 0 && (
          <div className="border-t border-border px-lg py-md">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dim mb-3">{t('relatedArticles')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {relatedArticles.map((ra) => (
                <button
                  key={ra.id}
                  type="button"
                  onClick={() =>
                    openTab({
                      kind: 'knowledge-article',
                      params: { id: ra.id },
                      title: ra.title,
                      icon: 'knowledge',
                    })
                  }
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-left text-xs hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <BookOpen className="h-3.5 w-3.5 text-dim shrink-0" />
                  <span className="truncate text-text font-medium">{ra.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table of Contents sidebar */}
      {headings.length > 2 && (
        <div className="hidden lg:flex w-52 shrink-0 flex-col border-l border-border bg-bg-subtle/30 p-md overflow-y-auto">
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-dim mb-3">
            {t('tableOfContents')}
          </h4>
          <nav className="flex flex-col gap-1">
            {headings.map((h, i) => (
              <a
                key={i}
                href={`#${h.id}`}
                className="text-xs text-muted hover:text-primary transition-colors leading-relaxed"
                style={{ paddingLeft: (h.level - 1) * 12 }}
              >
                {h.text}
              </a>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
