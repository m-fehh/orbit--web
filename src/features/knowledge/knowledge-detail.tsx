'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, ThumbsUp, BookOpen } from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { useTabStore } from '@/features/workspace/tab-store';
import { Button } from '@/shared/ui/button';

// ---------------------------------------------------------------------------
// Simple Markdown renderer (basic: headings, bold, italic, code, lists)
// ---------------------------------------------------------------------------

function renderMarkdown(md: string) {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let key = 0;

  for (const line of lines) {
    key++;
    if (line.startsWith('### ')) {
      elements.push(<h3 key={key} className="text-base font-semibold mt-4 mb-1">{line.slice(4)}</h3>);
    } else if (line.startsWith('## ')) {
      elements.push(<h2 key={key} className="text-lg font-semibold mt-5 mb-1">{line.slice(3)}</h2>);
    } else if (line.startsWith('# ')) {
      elements.push(<h1 key={key} className="text-xl font-bold mt-6 mb-2">{line.slice(2)}</h1>);
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(<li key={key} className="ml-4 list-disc text-sm">{line.slice(2)}</li>);
    } else if (line.trim() === '') {
      elements.push(<div key={key} className="h-2" />);
    } else {
      elements.push(<p key={key} className="text-sm leading-relaxed">{line}</p>);
    }
  }

  return <div className="prose-orbit">{elements}</div>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  const reuseMutation = useMutation({
    mutationFn: () => knowledgeApi.incrementReuse(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge', 'detail', id] });
    },
  });

  if (isLoading || !article) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted">{t('loading')}</p>
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

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <div className="border-b border-border px-lg py-md">
        <div className="flex items-start justify-between gap-md">
          <div className="flex-1">
            <h1 className="text-xl font-bold">{article.title}</h1>
            <p className="mt-1 text-sm text-muted">{article.summary}</p>
          </div>
          <div className="flex items-center gap-sm shrink-0">
            <Button
              size="sm"
              variant="outline"
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

      {/* Metadata */}
      <div className="flex items-center gap-lg border-b border-border px-lg py-sm text-xs text-muted">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" aria-hidden />
          {t('reuseCount')}: {article.reuseCount}
        </span>
        {article.isPublished && (
          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            {t('statusPublished')}
          </span>
        )}
        {article.createdAt && (
          <span>{t('createdAt')}: {formatDateTime(article.createdAt, { locale, timeZone })}</span>
        )}
        {article.updatedAt && (
          <span>{t('updatedAt')}: {formatDateTime(article.updatedAt, { locale, timeZone })}</span>
        )}
        {article.rootCauseId && (
          <span>{t('rootCause')}: #{article.rootCauseId}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-lg py-md">
        {renderMarkdown(article.content)}
      </div>
    </div>
  );
}
