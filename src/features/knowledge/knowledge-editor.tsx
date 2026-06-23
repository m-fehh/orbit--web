'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Send, Archive, RotateCcw, History, ChevronRight } from 'lucide-react';
import { knowledgeApi } from '@/shared/api/endpoints';
import { rootCausesApi } from '@/shared/api/endpoints';
import type {
  KnowledgeAssetResponse,
  KnowledgeAssetVersionResponse,
  RootCauseResponse,
} from '@/shared/api/types';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { RichEditor } from '@/shared/ui/rich-editor';
import { useTabStore } from '@/features/workspace/tab-store';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

function createArticleSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('titleRequired')),
    summary: z.string().min(1, t('summaryRequired')),
    content: z.string().min(1, t('contentRequired')),
    rootCauseId: z.number().nullable().optional(),
  });
}

type ArticleFormData = z.infer<ReturnType<typeof createArticleSchema>>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface KnowledgeEditorProps {
  id: number | 'new';
}

export function KnowledgeEditor({ id }: KnowledgeEditorProps) {
  const t = useTranslations('knowledge');
  const queryClient = useQueryClient();
  const openTab = useTabStore((s) => s.openTab);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<KnowledgeAssetVersionResponse | null>(null);

  const isNew = id === 'new';

  // --- Fetch article ---
  const { data: article, isLoading } = useQuery({
    queryKey: ['knowledge', 'detail', id],
    queryFn: () => knowledgeApi.get(id as number),
    enabled: !isNew,
  });

  // --- Fetch versions ---
  const { data: versions } = useQuery({
    queryKey: ['knowledge', 'versions', id],
    queryFn: () => knowledgeApi.versions(id as number),
    enabled: !isNew && showVersions,
  });

  // --- Fetch root causes for combobox ---
  const { data: rootCausesData } = useQuery({
    queryKey: ['rootcauses', 'list-all'],
    queryFn: () => rootCausesApi.list({ pageSize: 200 }),
  });
  const rootCauses: RootCauseResponse[] = rootCausesData?.items ?? [];

  // --- Form ---
  const articleSchema = createArticleSchema(t);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
    defaultValues: { title: '', summary: '', content: '', rootCauseId: null },
  });

  useEffect(() => {
    if (article) {
      reset({
        title: article.title,
        summary: article.summary,
        content: article.content,
        rootCauseId: article.rootCauseId,
      });
    }
  }, [article, reset]);

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (data: ArticleFormData) =>
      knowledgeApi.create({
        title: data.title,
        summary: data.summary,
        content: data.content,
        rootCauseId: data.rootCauseId ?? null,
      }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      // Navigate to the created article
      openTab({
        kind: 'knowledge-article',
        params: { id: created.id },
        title: created.title,
        icon: 'knowledge',
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ArticleFormData) =>
      knowledgeApi.update(id as number, {
        title: data.title,
        summary: data.summary,
        content: data.content,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => knowledgeApi.publish(id as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => knowledgeApi.archive(id as number),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (versionId: number) => knowledgeApi.rollback(id as number, versionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      setSelectedVersion(null);
    },
  });

  const onSave = handleSubmit((data) => {
    if (isNew) {
      createMutation.mutate(data);
    } else {
      updateMutation.mutate(data);
    }
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted">{t('loading')}</p>
      </div>
    );
  }

  const currentRootCauseId = watch('rootCauseId');

  return (
    <div className="flex h-full">
      {/* Main editor */}
      <div className="flex flex-1 flex-col overflow-y-auto">
        <div className="border-b border-border px-lg py-md">
          <div className="flex items-center justify-between gap-md">
            <h1 className="text-lg font-bold">
              {isNew ? t('newArticle') : t('editArticle')}
            </h1>
            <div className="flex items-center gap-sm">
              {!isNew && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVersions(!showVersions)}
                >
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {t('versions')}
                </Button>
              )}
            </div>
          </div>
        </div>

        <form onSubmit={onSave} className="flex flex-1 flex-col gap-lg p-lg overflow-y-auto">
          {/* Title */}
          <div className="flex flex-col gap-1">
            <label htmlFor="title" className="text-xs font-medium text-muted">
              {t('title')}
            </label>
            <Input
              id="title"
              {...register('title')}
              placeholder={t('titlePlaceholder')}
              className={cn(errors.title && 'border-red-500')}
            />
            {errors.title && (
              <p className="text-xs text-red-500">{errors.title.message}</p>
            )}
          </div>

          {/* Summary */}
          <div className="flex flex-col gap-1">
            <label htmlFor="summary" className="text-xs font-medium text-muted">
              {t('summary')}
            </label>
            <Input
              id="summary"
              {...register('summary')}
              placeholder={t('summaryPlaceholder')}
              className={cn(errors.summary && 'border-red-500')}
            />
            {errors.summary && (
              <p className="text-xs text-red-500">{errors.summary.message}</p>
            )}
          </div>

          {/* Root cause link */}
          <div className="flex flex-col gap-1">
            <label htmlFor="rootCauseId" className="text-xs font-medium text-muted">
              {t('rootCause')}
            </label>
            <select
              id="rootCauseId"
              value={currentRootCauseId ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                setValue('rootCauseId', val ? Number(val) : null, { shouldDirty: true });
              }}
              className="h-9 rounded-md border border-border bg-panel px-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">{t('noRootCause')}</option>
              {rootCauses.map((rc) => (
                <option key={rc.id} value={rc.id}>
                  {rc.title}
                </option>
              ))}
            </select>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col gap-1">
            <label htmlFor="content" className="text-xs font-medium text-muted">
              {t('content')}
            </label>
            <RichEditor
              value={watch('content') ?? ''}
              onChange={(html) => setValue('content', html, { shouldDirty: true })}
              placeholder={t('contentPlaceholder')}
              minHeight="300px"
              className={cn(errors.content && 'border-red-500')}
            />
            {errors.content && (
              <p className="text-xs text-red-500">{errors.content.message}</p>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-sm border-t border-border pt-md">
            <Button type="submit" size="sm" disabled={isSaving || (!isNew && !isDirty)}>
              <Save className="h-3.5 w-3.5" aria-hidden />
              {isSaving ? t('saving') : t('saveDraft')}
            </Button>
            {!isNew && (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending || article?.isPublished}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden />
                  {t('publish')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => archiveMutation.mutate()}
                  disabled={archiveMutation.isPending}
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                  {t('archive')}
                </Button>
              </>
            )}
          </div>
        </form>
      </div>

      {/* Version history sidebar */}
      {showVersions && (
        <div className="flex w-72 shrink-0 flex-col border-l border-border bg-bg-subtle/40">
          <div className="border-b border-border px-md py-sm">
            <h2 className="text-sm font-semibold">{t('versionHistory')}</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-sm">
            {versions && versions.length > 0 ? (
              <ul className="flex flex-col gap-1">
                {versions.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedVersion(v)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-md px-sm py-2 text-left text-xs transition-colors hover:bg-panel-2',
                        selectedVersion?.id === v.id && 'bg-primary-soft text-primary',
                      )}
                    >
                      <div>
                        <p className="font-medium">v{v.versionNumber}</p>
                        <p className="text-[11px] text-muted">{v.title}</p>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-sm py-2 text-xs text-muted">{t('noVersions')}</p>
            )}
          </div>

          {/* Version preview */}
          {selectedVersion && (
            <div className="border-t border-border p-sm">
              <h3 className="text-xs font-semibold mb-1">
                v{selectedVersion.versionNumber} - {selectedVersion.title}
              </h3>
              <p className="text-[11px] text-muted mb-2 line-clamp-3">
                {selectedVersion.summary}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => rollbackMutation.mutate(selectedVersion.id)}
                disabled={rollbackMutation.isPending}
                className="w-full"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                {t('rollback')}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
