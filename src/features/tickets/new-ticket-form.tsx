'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Sparkles, Lightbulb, ArrowRight, Loader2,
  Target, Zap,
} from 'lucide-react';
import { ticketsApi, usersApi, iterationsApi, tagsApi } from '@/shared/api/endpoints';
import {
  Priority, apiErrorMessage,
  type PriorityValue, type TicketCreatedResponse, type TagResponse,
} from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { useWindowStore } from '@/features/windows/window-store';
import { openTicketTab } from '@/features/tickets/ticket-actions';
import { openUsersIndexWindow } from '@/features/admin/admin-actions';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { CreatableCombobox, type CreatableOption } from '@/shared/ui/creatable-combobox';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';

function suggestTagIds(description: string, tags: TagResponse[]): number[] {
  if (!description || description.length < 10 || tags.length === 0) return [];
  const lower = description.toLowerCase();
  return tags
    .filter((t) => {
      const parts = t.name.toLowerCase().split(/[\s\-_\/]+/);
      return parts.some((p) => p.length >= 3 && lower.includes(p));
    })
    .slice(0, 5)
    .map((t) => t.id);
}

export function NewTicketForm({ windowId }: { windowId: string }) {
  const t = useTranslations('newTicket');
  const tPriority = useTranslations('priority');
  const qc = useQueryClient();
  const closeWindow = useWindowStore((s) => s.close);
  const currentUser = useAuthStore((s) => s.user);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityValue>(Priority.Medium);
  const [requesterId, setRequesterId] = useState<number | null>(currentUser?.id ?? null);
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [iterationId, setIterationId] = useState<number | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TicketCreatedResponse | null>(null);
  const [suggestedIds, setSuggestedIds] = useState<number[]>([]);

  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 100) });
  const iterations = useQuery({ queryKey: ['iterations'], queryFn: () => iterationsApi.list(1, 100, 'Active') });
  const tags = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });

  const userOptions: ComboOption[] = (users.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));
  const iterationOptions = (iterations.data ?? []).map((it: any) => ({ value: it.id, label: it.name }));
  const tagOptions: CreatableOption[] = (tags.data ?? []).map((tg) => ({ id: tg.id, label: tg.name, color: tg.color, group: tg.group }));
  const assigneeTeamId = assigneeId ? users.data?.items.find((u) => u.id === assigneeId)?.teamId ?? null : null;

  // Auto-select first active iteration
  useEffect(() => {
    if (!iterationId && iterations.data && iterations.data.length > 0) {
      setIterationId(iterations.data[0].id);
    }
  }, [iterations.data, iterationId]);

  // Auto-select current user as requester
  useEffect(() => {
    if (!requesterId && currentUser?.id) {
      setRequesterId(currentUser.id);
    }
  }, [currentUser, requesterId]);

  useEffect(() => {
    if (tags.data) setSuggestedIds(suggestTagIds(description, tags.data));
  }, [description, tags.data]);

  const createTagMut = useMutation({
    mutationFn: (name: string) => tagsApi.create({ name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });

  async function handleCreateTag(name: string): Promise<CreatableOption | null> {
    try {
      const created = await createTagMut.mutateAsync(name);
      return { id: created.id, label: created.name, color: created.color };
    } catch {
      return null;
    }
  }

  const canSubmit = title.trim().length >= 3 && description.trim().length >= 5 && requesterId && iterationId;

  async function submit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const created = await ticketsApi.create({
        title: title.trim(),
        description: description.trim(),
        priority,
        customerId: requesterId!,
        assignedUserId: assigneeId,
        assignedTeamId: assigneeTeamId,
        iterationId,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
      });
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setResult(created);
      toast.success(t('created', { number: created.ticket.number }));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('createError')));
    } finally {
      setSubmitting(false);
    }
  }

  // Stage 2 — AI analysis after creation
  if (result) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 px-4 py-3">
            <Sparkles className="h-5 w-5 text-success shrink-0" />
            <div>
              <p className="text-sm font-semibold text-success">{t('createdAndAnalyzed', { number: result.ticket.number })}</p>
              <p className="text-xs text-muted mt-0.5">{result.ticket.title}</p>
            </div>
          </div>

          {result.likelyRootCause && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-bold uppercase tracking-wide text-primary">{t('probableRootCause')}</p>
              </div>
              <p className="text-sm font-medium">{result.likelyRootCause}</p>
            </div>
          )}

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-warning" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-dim">{t('recommendedSolutions')}</p>
            </div>
            {result.recommendations.length === 0 ? (
              <p className="text-sm text-dim text-center py-6">{t('noSolutions')}</p>
            ) : (
              <div className="flex flex-col gap-2">
                {result.recommendations.map((r) => (
                  <div key={r.resolutionId} className="flex items-center gap-3 rounded-lg border border-border p-3">
                    <Lightbulb className="h-4 w-4 text-success shrink-0" />
                    <span className="flex-1 text-sm">{r.summary}</span>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                      {Math.round(r.score * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-panel p-4">
          <Button
            variant="secondary"
            onClick={() => {
              setResult(null);
              setTitle('');
              setDescription('');
              setSelectedTagIds([]);
            }}
          >
            {t('createAnother')}
          </Button>
          <Button onClick={() => { openTicketTab(result.ticket); closeWindow(windowId); }}>
            {t('openTicket')} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const hasSuggestions = suggestedIds.length > 0 && suggestedIds.some((id) => !selectedTagIds.includes(id));

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); void submit(); }}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-4 overflow-auto p-6">
        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>{t('subject')} <span className="text-danger">*</span></span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('subjectPlaceholder')} autoFocus />
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>{t('description')} <span className="text-danger">*</span></span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg-subtle px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-[3px] focus:ring-primary/10 resize-none transition-all"
            placeholder={t('descriptionPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('requester')} <span className="text-danger">*</span></span>
            <AsyncCombobox
              options={userOptions}
              value={requesterId}
              onChange={setRequesterId}
              loading={users.isLoading}
              placeholder={t('requesterPlaceholder')}
              allowClear={false}
              disabled={!!currentUser?.id}
              onCreate={openUsersIndexWindow}
              createLabel={t('manageUsers')}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('assignee')}</span>
            <AsyncCombobox
              options={userOptions}
              value={assigneeId}
              onChange={setAssigneeId}
              loading={users.isLoading}
              placeholder={t('assigneePlaceholder')}
              onCreate={openUsersIndexWindow}
              createLabel={t('manageUsers')}
            />
            {assigneeTeamId != null && (
              <span className="text-[11px] text-dim">{t('teamAutoHint')}</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('priority')}</span>
            <Select<PriorityValue>
              value={priority}
              onChange={setPriority}
              options={[
                { value: Priority.Low, label: tPriority('Low') },
                { value: Priority.Medium, label: tPriority('Medium') },
                { value: Priority.High, label: tPriority('High') },
                { value: Priority.Critical, label: tPriority('Critical') },
              ]}
            />
          </div>
          <div className="flex flex-col gap-1.5 text-sm font-medium">
            <span>{t('iteration')} <span className="text-danger">*</span></span>
            <Select<number>
              value={iterationId as number}
              onChange={(v) => setIterationId(v)}
              options={iterationOptions}
              placeholder={t('iterationPlaceholder')}
              disabled={iterationOptions.length === 1}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-sm font-medium">
          <span>{t('tags')}</span>
          <CreatableCombobox
            options={tagOptions}
            value={selectedTagIds}
            onChange={setSelectedTagIds}
            loading={tags.isLoading}
            placeholder={t('tags')}
            onCreate={handleCreateTag}
            createLabel={t('createTag')}
          />
          {hasSuggestions && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] font-medium text-dim flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" /> {t('suggestedTags')}
              </span>
              {suggestedIds
                .filter((id) => !selectedTagIds.includes(id))
                .map((id) => {
                  const tag = tagOptions.find((o) => o.id === id);
                  if (!tag) return null;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedTagIds((prev) => [...prev, id])}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/40 px-2 py-0.5 text-[11px] font-medium text-primary hover:border-primary hover:bg-primary/10 transition-all"
                    >
                      {tag.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />}
                      + {tag.label}
                    </button>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between border-t border-border bg-panel p-4">
        <span className="flex items-center gap-1.5 text-xs text-dim">
          <Sparkles className="h-3.5 w-3.5 text-primary" /> {t('analyzeHint')}
        </span>
        <div className="flex items-center gap-2">
          <Button type="button" variant="secondary" onClick={() => closeWindow(windowId)}>
            {t('cancel')}
          </Button>
          <Button type="submit" loading={submitting} disabled={!canSubmit}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t('analyzing')}</>
            ) : (
              t('submit')
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
