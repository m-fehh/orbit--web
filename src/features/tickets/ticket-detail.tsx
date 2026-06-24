'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, Clock, Info, Send, Lock, Timer, Sparkles, User, Users,
  Lightbulb, GitBranch, ChevronDown, UserPlus, Plus, Check, History, Paperclip, X,
  Edit3, Calendar, ArrowRight, Target, TrendingUp, BarChart3, Zap, ExternalLink,
  ChevronRight, Eye, Download, FileText, UploadCloud, Trash2, Minus,
  Link2, HelpCircle, Search, ShieldAlert, AlertTriangle, Bug, Wrench, BookOpen,
  FlaskConical, ListChecks, GanttChart, ArrowUpRight, ThumbsUp, ThumbsDown,
  Filter, Layers, Brain, Workflow, PieChart, Sigma, Loader2, RotateCcw
} from 'lucide-react';
import { ticketsApi, usersApi, teamsApi, intelligenceApi, worklogsApi, investigationsApi, rootCausesApi, resolutionsApi, workItemsApi, iterationsApi, tagsApi, symptomsApi, ticketSymptomsApi } from '@/shared/api/endpoints';
import {
  TicketStatus, STATUS_TRANSITIONS, apiErrorMessage, ApiError, EvidenceType, HypothesisStatus, RootCauseCategory,
  type TicketStatusValue, type TicketStatusName, type TicketAttachmentResponse,
  type InvestigationResponse, type HypothesisStatusValue, type EvidenceTypeValue, type RootCauseCategoryValue,
  type IterationResponse, type TagResponse, type SymptomTagResponse, type EngineeringWorkItemResponse,
} from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { PriorityBadge, StatusBadge } from './badges';
import { openTicketTab } from './ticket-actions';
import { useWindowStore } from '@/features/windows/window-store';
import { Can } from '@/features/auth/can';
import { useAuthStore } from '@/features/auth/auth-store';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { SlaPanel } from './sla-panel';
import { TicketTimeline } from './timeline';
import { tokenStore } from '@/shared/api/token-store';
import { Portal } from '@/shared/ui/portal';
import { Checkbox } from '@/shared/ui/checkbox';
import { RichEditor } from '@/shared/ui/rich-editor';
import { MarkdownEditor, MarkdownContent } from '@/shared/ui/markdown-editor';
import { openIntelligenceModal } from './intelligence-modal';

type SubTab = 'overview' | 'timeline' | 'conversation' | 'worklogs' | 'investigation' | 'workItems' | 'attachments';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FIELD_BASE =
  'w-full rounded-md border border-border bg-bg-subtle px-2.5 py-2 text-sm text-text outline-none ' +
  'placeholder:text-dim transition-colors hover:border-border-strong focus:border-primary ' +
  'focus:ring-2 focus:ring-primary/20';
const FIELD_MD = `${FIELD_BASE} h-9`;
const FIELD_SM = `${FIELD_BASE} h-8 text-xs`;

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(contentType: string): boolean {
  return contentType.startsWith('image/');
}

function isPdf(contentType: string): boolean {
  return contentType === 'application/pdf';
}

function canPreview(contentType: string): boolean {
  return isImage(contentType) || isPdf(contentType);
}

async function fetchBlobUrl(id: number): Promise<string> {
  const token = tokenStore.getAccessToken();
  const res = await fetch(ticketsApi.downloadAttachmentUrl(id), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return URL.createObjectURL(await res.blob());
}

export function TicketDetail({ id }: { id: number }) {
  const locale = useLocale() as Locale;
  const tSla = useTranslations('sla');
  const tTicket = useTranslations('ticket');
  const tIntelMain = useTranslations('intelligence');
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>('overview');
  const [showResolveModal, setShowResolveModal] = useState(false);

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketsApi.get(id),
  });
  const { data: sla } = useQuery({ queryKey: ['tickets', 'sla', id], queryFn: () => ticketsApi.getSla(id), enabled: !!ticket });
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 100) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const userOptions: ComboOption[] = (users.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));
  const userName = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.name ?? tTicket('userFallback', { id: uid }) : '—');
  const teamName = (tid: number | null) => (tid ? teams.data?.find((t) => t.id === tid)?.name ?? tTicket('teamFallback', { id: tid }) : '—');
  const userEmail = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.email ?? null : null);

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatusValue) => ticketsApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success(tTicket('statusUpdated'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, tTicket('statusError'))),
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState('');

  const updateTicket = useMutation({
    mutationFn: (body: { title: string; description: string }) => ticketsApi.update(id, body),
    onSuccess: () => {
      toast.success(tTicket('updated'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
      setEditingTitle(false);
      setEditingDesc(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, tTicket('updateError'))),
  });

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    // Upload to API (for attachments tab), but return base64 data URI so
    // the editor can display the image without auth headers in <img src>.
    ticketsApi.uploadAttachment(id, file).then(() => {
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', id] });
    });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, [id, qc]);

  if (isLoading) return <LoadingState label={tTicket('loading')} />;
  if (isError || !ticket)
    return <ErrorState title={tTicket('loadError')} onRetry={() => refetch()} retryLabel={tTicket('retry')} />;

  const tabs: { key: SubTab; label: string; icon: typeof Info; count?: number }[] = [
    { key: 'overview', label: tTicket('tabOverview'), icon: Info },
    { key: 'timeline', label: tTicket('tabTimeline'), icon: History },
    { key: 'conversation', label: tTicket('tabConversation'), icon: MessageSquare, count: ticket.comments.length },
    { key: 'worklogs', label: tTicket('tabWorklogs'), icon: Clock, count: ticket.worklogs.length },
    { key: 'investigation', label: tTicket('tabInvestigation'), icon: FlaskConical, count: ticket.investigations.length },
    { key: 'workItems', label: tTicket('tabWorkItems'), icon: ListChecks },
    { key: 'attachments', label: tTicket('tabAttachments'), icon: Paperclip },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border bg-bg-subtle/30 px-lg pt-lg pb-md">
        <div className="flex flex-wrap items-start gap-sm">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-sm">
              <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-primary">
                {ticket.number}
              </span>
            </div>
            {editingTitle ? (
              <div className="mt-1 flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 rounded-md border border-primary bg-bg-subtle px-2 py-1 text-2xl font-bold leading-tight outline-none ring-2 ring-primary/15"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && editTitle.trim()) updateTicket.mutate({ title: editTitle.trim(), description: ticket.description });
                    if (e.key === 'Escape') setEditingTitle(false);
                  }}
                />
                <button type="button" onClick={() => { if (editTitle.trim()) updateTicket.mutate({ title: editTitle.trim(), description: ticket.description }); }} disabled={updateTicket.isPending} className="grid h-7 w-7 place-items-center rounded bg-success/15 text-success hover:bg-success/25"><Check className="h-4 w-4" /></button>
                <button type="button" onClick={() => setEditingTitle(false)} className="grid h-7 w-7 place-items-center rounded bg-panel-2 text-dim hover:text-text"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <h1
                className="mt-1 truncate text-2xl font-bold leading-tight cursor-pointer hover:text-primary/80 transition-colors"
                onClick={() => { setEditTitle(ticket.title); setEditingTitle(true); }}
                title={tTicket('clickToEdit')}
              >
                {ticket.title}
              </h1>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-sm">
            <Can permission="ticket.assign">
              <AssignControl
                ticketId={id}
                currentUserId={ticket.assignedUserId}
                currentUserName={ticket.assignedUserId ? userName(ticket.assignedUserId) : null}
                currentUserEmail={userEmail(ticket.assignedUserId)}
                userOptions={userOptions}
                resolveUserTeam={(uid) => users.data?.items.find((u) => u.id === uid)?.teamId ?? null}
              />
            </Can>
            <Can permission="ticket.status">
              <StatusPicker value={ticket.status} disabled={changeStatus.isPending} onChange={(v) => {
                if (v === TicketStatus.Resolved) {
                  setShowResolveModal(true);
                } else {
                  changeStatus.mutate(v);
                }
              }} />
            </Can>
            <IterationControl ticketId={id} ticketTitle={ticket.title} ticketDescription={ticket.description ?? ''} currentIteration={ticket.iteration ?? null} currentIterationId={ticket.iterationId ?? null} />
            {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-primary hover:bg-primary/10"
                onClick={() => openIntelligenceModal(id, ticket.title, tIntelMain('modalTitle', { title: ticket.title }))}
              >
                <Brain className="h-4 w-4" />
                {tTicket('assistantButton')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-md flex flex-wrap items-center justify-between gap-y-1 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            {ticket.iteration && (
              <>
                <span className="text-dim">·</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-primary font-medium">
                  <Layers className="h-3 w-3" />
                  {ticket.iteration.name}
                </span>
              </>
            )}
            <span className="text-dim">·</span>
            <TagsBar ticketId={id} currentTags={ticket.tags ?? []} />
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {tTicket('openedAt')} {formatDateTime(ticket.openedAt, { locale, timeZone })}
            </span>
            {ticket.closedAt && (
              <>
                <span className="text-dim">·</span>
                <span className="inline-flex items-center gap-1 text-success">
                  <Check className="h-3 w-3" />
                  {tTicket('closedAt')} {formatDateTime(ticket.closedAt, { locale, timeZone })}
                </span>
              </>
            )}
            {ticket.updatedAt && (
              <>
                <span className="text-dim">·</span>
                <span className="inline-flex items-center gap-1">
                  <Edit3 className="h-3 w-3" />
                  {tTicket('updatedAt')} {formatDateTime(ticket.updatedAt, { locale, timeZone })}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-lg">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setSub(tb.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-md py-2 text-sm transition-colors',
               sub === tb.key ? 'border-primary text-primary bg-panel' : 'border-transparent text-muted hover:text-text',
            )}
          >
            <tb.icon className="h-4 w-4" /> {tb.label}
            {tb.count !== undefined && tb.count > 0 && (
              <span className="rounded-full bg-panel-2 px-1.5 text-xs text-dim">{tb.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className={cn('min-h-0 flex-1 p-lg', sub === 'conversation' ? 'overflow-hidden flex flex-col' : 'overflow-auto')}>
        {sub === 'overview' && (
          <div className="grid items-start gap-lg lg:grid-cols-3">
            <div className="flex flex-col gap-lg lg:col-span-2">
              <div>
                <div className="mb-sm flex items-center justify-between">
                  <p className="h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('description')}</p>
                  {!editingDesc && (
                    <button type="button" onClick={() => { setEditDesc(ticket.description); setEditingDesc(true); }} className="text-[10px] text-primary hover:underline">{tTicket('edit')}</button>
                  )}
                </div>
                {editingDesc ? (
                  <div className="flex flex-col gap-2">
                    <MarkdownEditor
                      value={editDesc}
                      onChange={setEditDesc}
                      placeholder={tTicket('descriptionPh')}
                      minHeight="140px"
                      onImagePaste={uploadImage}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button type="button" onClick={() => setEditingDesc(false)} className="rounded-md border border-border px-3 py-1.5 text-xs text-dim hover:text-text">{tTicket('cancel')}</button>
                      <button type="button" onClick={() => updateTicket.mutate({ title: ticket.title, description: editDesc })} disabled={updateTicket.isPending} className="rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50">{tTicket('save')}</button>
                    </div>
                  </div>
                ) : (
                  <div className="card-surface min-h-[140px] p-lg cursor-pointer hover:border-primary/30 transition-colors" onClick={() => { setEditDesc(ticket.description); setEditingDesc(true); }}>
                    {ticket.description ? <MarkdownContent content={ticket.description} /> : <span className="text-dim text-sm">—</span>}
                  </div>
                )}
              </div>

              {(ticket.status === 'Resolved' || ticket.status === 'Closed') ? (
                <ResolutionSummaryPanel ticketId={id} estimateMinutes={ticket.estimateMinutes} completedMinutes={ticket.completedMinutes} closedAt={ticket.closedAt} openedAt={ticket.openedAt} />
              ) : (
                <>
                  <IntelligenceQuickView ticketId={id} onExpand={() => openIntelligenceModal(id, ticket.title, tIntelMain('modalTitle', { title: ticket.title }))} />
                  <RecommendationsPanel ticketId={id} onOpenIntelligence={() => openIntelligenceModal(id, ticket.title, tIntelMain('modalTitle', { title: ticket.title }))} />
                </>
              )}
            </div>
            <aside className="flex flex-col gap-lg">
              <div>
                <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('details')}</p>
                <div className="card-surface flex flex-col gap-3 p-lg text-sm">
                  <Detail icon={User} label={tTicket('requester')} value={userName(ticket.customerId)} />
                  <Detail icon={UserPlus} label={tTicket('assignee')} value={userName(ticket.assignedUserId)} />
                  <Detail icon={Users} label={tTicket('team')} value={teamName(ticket.assignedTeamId)} />
                  <Detail icon={Calendar} label={tTicket('openedAt')} value={formatDateTime(ticket.openedAt, { locale, timeZone })} />
                  {ticket.updatedAt && (
                    <Detail icon={Edit3} label={tTicket('updatedAt')} value={formatDateTime(ticket.updatedAt, { locale, timeZone })} />
                  )}
                </div>
              </div>

              <div>
                <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('timeTracking')}</p>
                <TimeTrackingCard
                  ticketId={id}
                  estimateMinutes={ticket.estimateMinutes}
                  completedMinutes={ticket.completedMinutes}
                  remainingMinutes={ticket.remainingMinutes}
                />
              </div>

              <div>
                <p className="mb-sm h-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim">
                  <Timer className="h-3.5 w-3.5" /> {tSla('label')}
                </p>
                <div className="card-surface p-lg">
                  <SlaPanel sla={sla} />
                </div>
              </div>
            </aside>
          </div>
        )}

        {sub === 'timeline' && <TicketTimeline ticket={ticket} userName={userName} teamName={teamName} />}

        {sub === 'conversation' && <Conversation ticketId={id} comments={ticket.comments} userName={userName} locale={locale} timeZone={timeZone} onImagePaste={uploadImage} />}

        {sub === 'worklogs' && (
          <WorklogsTab
            ticketId={id}
            worklogs={ticket.worklogs}
            userName={userName}
            estimateMinutesServer={ticket.estimateMinutes}
            remainingMinutesServer={ticket.remainingMinutes}
            completedMinutesServer={ticket.completedMinutes}
          />
        )}

        {sub === 'investigation' && <InvestigationTab ticketId={id} investigations={ticket.investigations} />}

        {sub === 'workItems' && <WorkItemsTab ticketId={id} />}

        {sub === 'attachments' && <AttachmentsTab ticketId={id} userName={userName} investigations={ticket.investigations} />}
      </div>

      {showResolveModal && (
        <ResolveModal
          ticketId={id}
          ticketTitle={ticket.title}
          ticketSymptoms={ticket.symptoms ?? []}
          onClose={() => setShowResolveModal(false)}
          onResolved={() => {
            setShowResolveModal(false);
            qc.invalidateQueries({ queryKey: ['tickets'] });
          }}
        />
      )}
    </div>
  );
}

/* ---- Estimate Input ---- */
function TimeTrackingCard({ ticketId, estimateMinutes, completedMinutes, remainingMinutes }: {
  ticketId: number;
  estimateMinutes: number | null;
  completedMinutes: number;
  remainingMinutes: number | null;
}) {
  const t = useTranslations('worklog');
  const tTicket = useTranslations('ticket');
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [estimateInput, setEstimateInput] = useState<string>(estimateMinutes ? String(estimateMinutes / 60) : '');

  const estMin = Math.max(0, estimateMinutes ?? 0);
  const remMin = remainingMinutes != null ? Math.max(0, remainingMinutes) : Math.max(0, estMin - completedMinutes);
  const over = completedMinutes > estMin && estMin > 0;
  const progress = estMin > 0 ? Math.min(100, (completedMinutes / estMin) * 100) : 0;

  const saveTracking = useMutation({
    mutationFn: () =>
      ticketsApi.updateTracking(ticketId, {
        estimateMinutes: estimateInput.trim() === '' ? null : Math.round(Number(estimateInput) * 60),
        remainingMinutes: null,
      }),
    onSuccess: () => {
      toast.success(t('trackingUpdated'));
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      setEditing(false);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('trackingError'))),
  });

  return (
    <div className="card-surface overflow-hidden">
      <div className="p-md">
        {/* Ring + stats row */}
        <div className="flex items-center gap-3">
          {/* SVG ring */}
          {(() => {
            const r = 22, circ = 2 * Math.PI * r;
            const pct = estMin > 0 ? Math.min(1, completedMinutes / estMin) : 0;
            return (
              <svg width="56" height="56" viewBox="0 0 56 56" className="shrink-0">
                <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth="6" />
                {pct > 0 && (
                  <circle cx="28" cy="28" r={r} fill="none"
                    stroke={over ? 'var(--color-danger)' : 'var(--color-primary)'}
                    strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                    transform="rotate(-90 28 28)"
                    style={{ transition: 'stroke-dashoffset .4s ease' }}
                  />
                )}
                <text x="28" y="32" textAnchor="middle" fontSize="9" fontWeight="700" fill={over ? 'var(--color-danger)' : 'var(--color-text)'}>
                  {fmtMin(completedMinutes)}
                </text>
              </svg>
            );
          })()}

          {/* Stats */}
          <div className="flex-1 flex flex-col gap-1.5 text-xs min-w-0">
            <div className="flex justify-between">
              <span className="text-dim">{tTicket('estimated')}</span>
              <span className="font-semibold tabular-nums">{estMin > 0 ? fmtMin(estMin) : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">{tTicket('completed')}</span>
              <span className="font-semibold tabular-nums text-primary">{fmtMin(completedMinutes)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dim">{tTicket('remaining')}</span>
              <span className={cn('font-semibold tabular-nums', over ? 'text-danger' : 'text-text')}>
                {estMin > 0 ? fmtMin(remMin) : '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        {estMin > 0 && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className={cn('h-full rounded-full transition-all duration-500', over ? 'bg-danger' : 'bg-primary')}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Estimate setter */}
      <div className="border-t border-border bg-panel-2/20 px-md py-2">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number" min={0} step={0.5}
              value={estimateInput}
              onChange={(e) => setEstimateInput(e.target.value)}
              placeholder="0"
              className="h-7 flex-1 text-xs"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') saveTracking.mutate(); if (e.key === 'Escape') setEditing(false); }}
            />
            <span className="text-[10px] text-dim shrink-0">h</span>
            <Button size="sm" onClick={() => saveTracking.mutate()} loading={saveTracking.isPending} className="h-7 text-xs px-3">
              {t('save')}
            </Button>
            <button type="button" onClick={() => setEditing(false)} className="text-dim hover:text-text">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex w-full items-center gap-1.5 text-[10px] text-dim hover:text-primary transition-colors"
          >
            <Timer className="h-3 w-3" />
            {estMin > 0 ? t('estimate') + ': ' + fmtMin(estMin) : t('setEstimate')}
            <Edit3 className="h-3 w-3 ml-auto opacity-50" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---- Status picker ---- */
function StatusPicker({ value, onChange, disabled }: { value: TicketStatusName; onChange: (v: TicketStatusValue) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const options = [value, ...STATUS_TRANSITIONS[value]];
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} disabled={disabled} className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-sm hover:border-border-strong disabled:opacity-50">
        <StatusBadge status={value} />
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-56 overflow-hidden rounded-md border border-border bg-panel py-1 shadow-lg">
            {options.map((name) => (
              <button key={name} type="button" onClick={() => { if (name !== value) onChange(TicketStatus[name]); setOpen(false); }} className="flex w-full items-center justify-between px-md py-1.5 text-left hover:bg-panel-2">
                <StatusBadge status={name} />
                {name === value && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Assign Control ---- */
function AssignControl({ ticketId, currentUserId, currentUserName, currentUserEmail, userOptions, resolveUserTeam }: { ticketId: number; currentUserId: number | null; currentUserName: string | null; currentUserEmail: string | null; userOptions: ComboOption[]; resolveUserTeam: (userId: number) => number | null }) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<number | null>(currentUserId);

  const assign = useMutation({
    mutationFn: () => ticketsApi.assign(ticketId, userId!, resolveUserTeam(userId!)),
    onSuccess: () => { toast.success(t('assignedOk')); qc.invalidateQueries({ queryKey: ['tickets'] }); setOpen(false); },
    onError: (err) => toast.error(apiErrorMessage(err, t('assignError'))),
  });

  const initials = (currentUserName ?? '?').split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={cn('inline-flex h-9 items-center gap-2 rounded-md border bg-panel text-sm transition-colors hover:border-border-strong', currentUserId ? 'border-border pl-1 pr-2.5' : 'border-dashed border-border px-3 text-muted')} title={currentUserId ? `${currentUserName}${currentUserEmail ? ` · ${currentUserEmail}` : ''}` : t('assign')}>
        {currentUserId ? (
          <>
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">{initials || '?'}</span>
            <span className="max-w-[140px] truncate font-medium text-text">{currentUserName}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-dim" />
          </>
        ) : (
          <><UserPlus className="h-4 w-4" /> {t('assign')}</>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-72 rounded-md border border-border bg-panel p-md shadow-lg">
            <p className="mb-1.5 text-xs font-medium text-muted">{t('assignee')}</p>
            <AsyncCombobox options={userOptions} value={userId} onChange={setUserId} placeholder={t('selectUser')} allowClear={false} />
            <p className="mt-1.5 text-xs text-dim">{t('teamAutoHint')}</p>
            <Button className="mt-md w-full justify-center" disabled={!userId || assign.isPending} loading={assign.isPending} onClick={() => assign.mutate()}>{t('assign')}</Button>
          </div>
        </>
      )}
    </div>
  );
}

function Detail({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-start gap-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-dim" />
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-dim">{label}</p>
        <p className="truncate text-sm text-text">{value}</p>
      </div>
    </div>
  );
}

function TrackMini({ label, value, accent }: { label: string; value: string; accent?: 'primary' | 'danger' }) {
  return (
    <div className="rounded-md bg-panel-2/50 px-1 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className={cn('text-sm font-bold', accent === 'primary' && 'text-primary', accent === 'danger' && 'text-danger', !accent && 'text-text')}>{value}</p>
    </div>
  );
}

/* ---- Related Tickets Preview (modal content) ---- */
function RelatedTicketsPreview({ ticketIds }: { ticketIds: number[] }) {
  const t = useTranslations('intelligence');
  const queries = useQueries({
    queries: ticketIds.map((id) => ({
      queryKey: ['tickets', 'detail', id],
      queryFn: () => ticketsApi.get(id),
      retry: false as const,
    })),
  });
  return (
    <div className="flex flex-col gap-2 p-md overflow-y-auto max-h-[400px]">
      {queries.map((q, i) => {
        const tid = ticketIds[i];
        if (q.isLoading) return <div key={tid} className="animate-pulse rounded-lg bg-panel-2/50 h-16" />;
        if (q.isError || !q.data) return <div key={tid} className="rounded-lg border border-danger/20 bg-danger/5 p-3 text-xs text-danger">#{tid} — {t('analysisError')}</div>;
        const tk = q.data;
        return (
          <div key={tid} className="flex items-center gap-3 rounded-lg border border-border bg-panel/60 p-3 hover:border-primary/30 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-primary">#{tk.number}</span>
                {tk.status && <StatusBadge status={tk.status} />}
                {tk.priority && <PriorityBadge priority={tk.priority} />}
              </div>
              <p className="text-sm font-medium text-text truncate">{tk.title}</p>
              {tk.createdAt && <p className="text-[10px] text-dim mt-0.5">{formatDateTime(tk.createdAt, { locale: 'pt-BR' as Locale, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p>}
            </div>
            <Button size="sm" variant="ghost" className="h-7 shrink-0 text-xs gap-1" onClick={() => openTicketTab({ id: tk.id, number: tk.number, title: tk.title })}>
              <ArrowUpRight className="h-3 w-3" /> {t('openTicket')}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function openRelatedTicketsModal(ticketIds: number[], title?: string) {
  useWindowStore.getState().open({
    id: `related-tickets-${ticketIds.join('-')}`,
    title: title ?? 'Related Tickets',
    icon: <Layers className="h-4 w-4" />,
    modal: true,
    width: 520,
    height: 420,
    content: <RelatedTicketsPreview ticketIds={ticketIds} />,
  });
}

/* ---- Resolution Summary (resolved tickets) ---- */
function ResolutionSummaryPanel({ ticketId, estimateMinutes, completedMinutes, closedAt, openedAt }: {
  ticketId: number;
  estimateMinutes?: number | null;
  completedMinutes: number;
  closedAt?: string | null;
  openedAt: string;
}) {
  const t = useTranslations('resolution');
  const tTicket = useTranslations('ticket');
  const tWork = useTranslations('workItems');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const resolution = useQuery({
    queryKey: ['resolutions', 'byTicket', ticketId],
    queryFn: () => resolutionsApi.byTicket(ticketId),
    retry: false,
  });
  const rootCauses = useQuery({
    queryKey: ['rootcauses', 'byTicket', ticketId],
    queryFn: () => rootCausesApi.byTicket(ticketId),
    retry: false,
  });
  const workItems = useQuery({
    queryKey: ['workitems', ticketId],
    queryFn: () => workItemsApi.byTicket(ticketId),
    retry: false,
  });
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 200) });
  const userMap = new Map((users.data?.items ?? []).map(u => [u.id, u.name]));

  if (resolution.isLoading) {
    return (
      <div className="card-surface p-md">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-success" />
          <span className="text-xs text-muted">{tTicket('loading')}</span>
        </div>
      </div>
    );
  }

  const res = resolution.data;
  const rc = rootCauses.data?.[0];

  if (!res) return null;

  const totalTimeMs = closedAt && openedAt ? new Date(closedAt).getTime() - new Date(openedAt).getTime() : null;
  const totalTimeHours = totalTimeMs ? Math.round(totalTimeMs / (1000 * 60 * 60) * 10) / 10 : null;
  const efficiencyPct = (estimateMinutes && completedMinutes && estimateMinutes > 0)
    ? Math.round((completedMinutes / estimateMinutes) * 100)
    : null;

  const tasks = workItems.data ?? [];
  const tasksDone = tasks.filter(wi => wi.status === 'Done').length;

  return (
    <div className="flex flex-col gap-md">
      {/* Card 1: Resolution Summary */}
      <div className="card-surface overflow-hidden border border-success/20">
        {/* Header */}
        <div className="flex items-center gap-3 bg-gradient-to-r from-success/10 via-success/5 to-transparent px-md py-3">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-success/15">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-success">{t('resolvedSummaryTitle')}</p>
            {res.resolvedAt && (
              <p className="text-[10px] text-muted">{t('resolutionDate')}: {formatDateTime(res.resolvedAt, { locale, timeZone })}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 p-md text-sm">
          {/* Time finalization */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{t('timeFinalization')}</p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-panel-2/50 px-3 py-2 text-center">
                <p className="text-[9px] uppercase text-dim">{tTicket('estimated')}</p>
                <p className="text-sm font-bold text-text">{fmtMin(estimateMinutes ?? 0)}</p>
              </div>
              <div className="rounded-lg bg-panel-2/50 px-3 py-2 text-center">
                <p className="text-[9px] uppercase text-dim">{tTicket('completed')}</p>
                <p className="text-sm font-bold text-primary">{fmtMin(completedMinutes)}</p>
              </div>
              <div className="rounded-lg bg-panel-2/50 px-3 py-2 text-center">
                <p className="text-[9px] uppercase text-dim">{t('totalLifecycle')}</p>
                <p className="text-sm font-bold text-text">{totalTimeHours != null ? `${totalTimeHours}h` : '—'}</p>
              </div>
              <div className="rounded-lg bg-panel-2/50 px-3 py-2 text-center">
                <p className="text-[9px] uppercase text-dim">{t('efficiency')}</p>
                <p className={cn(
                  'text-sm font-bold',
                  efficiencyPct != null && efficiencyPct <= 100 ? 'text-success' : efficiencyPct != null ? 'text-warning' : 'text-text',
                )}>
                  {efficiencyPct != null ? `${efficiencyPct}%` : '—'}
                </p>
              </div>
            </div>
            {closedAt && openedAt && (
              <p className="text-[10px] text-dim mt-1.5">
                {t('openToClose')}: {formatDateTime(openedAt, { locale, timeZone })} → {formatDateTime(closedAt, { locale, timeZone })}
              </p>
            )}
          </div>

          {/* Root cause */}
          {rc && (
            <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">{t('rootCause')}</p>
                <span className="ml-auto rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{rc.category}</span>
              </div>
              <p className="font-medium text-text">{rc.title}</p>
              {rc.description && <p className="text-xs text-muted mt-1 leading-relaxed">{rc.description}</p>}
            </div>
          )}

          {/* Resolution summary */}
          <div className="rounded-lg border border-success/20 bg-success/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-success" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-success">{t('resolution')}</p>
            </div>
            <p className="text-text leading-relaxed">{res.summary}</p>
          </div>

          {/* Learnings */}
          {res.learnings.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-warning" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-warning">{t('learnings')}</p>
              </div>
              <div className="space-y-1.5">
                {res.learnings.map(l => (
                  <div key={l.id} className="flex items-start gap-2 rounded-md bg-warning/5 border border-warning/10 px-3 py-2">
                    <Lightbulb className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs text-text">{l.description}</p>
                      {l.impact && <p className="text-[10px] text-dim mt-0.5">{l.impact}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Card 2: Solution Roadmap */}
      {(res.resolutionSteps || res.outcome || tasks.length > 0) && (
        <div className="card-surface overflow-hidden border border-primary/15">
          <div className="flex items-center gap-3 bg-gradient-to-r from-primary/8 via-primary/3 to-transparent px-md py-3">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10">
              <ListChecks className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-primary">{t('solutionRoadmap')}</p>
              <p className="text-[10px] text-muted">{t('solutionRoadmapHint')}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4 p-md text-sm">
            {/* Steps roadmap */}
            {res.resolutionSteps && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-dim" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('actions')}</p>
                </div>
                <div className="ml-1 border-l-2 border-success/20 pl-4 space-y-2">
                  {res.resolutionSteps.split('\n').filter(Boolean).map((step, i) => (
                    <div key={i} className="flex items-start gap-2 relative">
                      <div className="absolute -left-[21px] top-1 grid h-4 w-4 place-items-center rounded-full bg-success/15 ring-2 ring-[var(--color-bg)]">
                        <Check className="h-2.5 w-2.5 text-success" />
                      </div>
                      <p className="text-xs text-text leading-relaxed">{step.replace(/^[-•\d.]\s*/, '')}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Outcome */}
            {res.outcome && (
              <div className="rounded-lg border border-border bg-bg-subtle/50 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <TrendingUp className="h-4 w-4 text-success" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-success">{t('outcome')}</p>
                </div>
                <p className="text-text leading-relaxed">{res.outcome}</p>
              </div>
            )}

            {/* Work items summary */}
            {tasks.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ListChecks className="h-4 w-4 text-dim" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-dim">{t('workItemsSummary')}</p>
                  <span className="ml-auto text-[10px] text-dim">
                    {tWork('tasksSummary', { done: tasksDone, total: tasks.length })}
                  </span>
                </div>
                <div className="space-y-1">
                  {tasks.map((wi) => (
                    <div key={wi.id} className="flex items-center gap-2 rounded-md bg-panel-2/40 px-3 py-1.5">
                      {wi.status === 'Done'
                        ? <Check className="h-3 w-3 text-emerald-600 shrink-0" />
                        : wi.status === 'Cancelled'
                          ? <X className="h-3 w-3 text-slate-400 shrink-0" />
                          : <div className="h-3 w-3 rounded-full border-2 border-blue-400 shrink-0" />
                      }
                      <span className={cn('text-xs flex-1 truncate', wi.status === 'Done' && 'line-through text-dim')}>
                        {wi.title}
                      </span>
                      {wi.assignedToId && (
                        <span className="text-[10px] text-dim shrink-0">{userMap.get(wi.assignedToId) ?? ''}</span>
                      )}
                      <span className={cn('shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold', taskStatusColor(wi.status))}>
                        {tWork(`status.${wi.status}` as 'status.Open')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- Intelligence Quick View ---- */
function pct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${Math.round(v * 100)}%`;
}

function IntelligenceQuickView({ ticketId, onExpand }: { ticketId: number; onExpand: () => void }) {
  const t = useTranslations('intelligence');
  const tTicket = useTranslations('ticket');
  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="card-surface p-md border border-primary/10">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs text-muted">{t('analyzing')}</span>
        </div>
      </div>
    );
  }

  if (!data || (data.rootCauseCandidates.length === 0 && data.resolutionSuggestions.length === 0)) {
    return null;
  }

  const causes = data.rootCauseCandidates;
  const resolutions = data.resolutionSuggestions;
  const hasMeaningfulData = causes.some(c => c.description) || resolutions.length > 0;

  if (!hasMeaningfulData) return null;

  return (
    <div className="card-surface overflow-hidden border border-primary/20">
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-primary/8 to-transparent px-md py-2.5">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-primary/15">
            <Brain className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs font-semibold text-primary">{t('title')}</p>
          {causes.some(c => c.aiEnhanced) && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t('ai')}</span>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onExpand} className="h-6 text-xs gap-1">
          {t('viewMore')} <ArrowRight className="h-3 w-3" />
        </Button>
      </div>

      <div className="p-md">
        <div className="grid gap-3 md:grid-cols-1">
          {/* Pattern Analysis — contextual data, NOT root cause */}
          {causes.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-dim">{t('patternContext')}</span>
              </div>
              {causes.slice(0, 3).map((rc, i) => {
                const relatedCount = rc.supportingTicketIds.length;
                return (
                  <div key={i} className="rounded-lg border border-border bg-panel/60 p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{rc.category}</span>
                      {relatedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => openRelatedTicketsModal(rc.supportingTicketIds, t('relatedTicketsTitle'))}
                          className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15 transition-colors cursor-pointer"
                        >
                          <Layers className="h-2.5 w-2.5" /> {relatedCount} {tTicket('relatedTickets')}
                        </button>
                      )}
                    </div>
                    {rc.description && (
                      <p className="text-xs text-muted leading-relaxed line-clamp-2">{rc.description}</p>
                    )}
                    {(rc.coOccurrencePatterns ?? []).length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 mt-1.5">
                        {(rc.coOccurrencePatterns ?? []).slice(0, 3).map((p) => (
                          <span key={p} className="rounded bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Resolutions */}
          {resolutions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 text-success" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-dim">{t('resolutions')}</span>
              </div>
              {resolutions.slice(0, 3).map((r) => (
                <div key={r.resolutionId} className="rounded-lg border border-border bg-panel/60 p-2.5">
                  <p className="text-xs font-medium text-text line-clamp-2 mb-1.5">{r.summary}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.successRate != null && !isNaN(r.successRate) && (
                      <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[9px] font-bold text-success">
                        {pct(r.successRate)} {t('success')}
                      </span>
                    )}
                    {r.reusedCount > 0 && (
                      <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[9px] font-medium text-dim">
                        {r.reusedCount}× {t('reuse')}
                      </span>
                    )}
                    {(r.matchedTerms ?? []).slice(0, 3).map((term) => (
                      <span key={term} className="rounded bg-primary/8 px-1.5 py-0.5 text-[9px] text-primary">{term}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {data.generatedAt && (
          <p className="mt-3 text-[10px] text-dim text-right">
            {t('aiDisclaimer')}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---- Recommendations Panel ---- */
function RecommendationsPanel({ ticketId, onOpenIntelligence }: { ticketId: number; onOpenIntelligence: () => void }) {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const [handled, setHandled] = useState<Record<number, 'accepted' | 'ignored'>>({});
  const report = useQuery({ queryKey: ['tickets', 'intelligence', ticketId], queryFn: () => intelligenceApi.ticketReport(ticketId), retry: false });
  const feedback = useMutation({
    mutationFn: (v: { resolutionId: number; accepted: boolean }) => ticketsApi.recommendationFeedback(ticketId, { resolutionId: v.resolutionId, accepted: v.accepted, helpful: v.accepted }),
    onSuccess: (_d, v) => { setHandled((h) => ({ ...h, [v.resolutionId]: v.accepted ? 'accepted' : 'ignored' })); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); toast.success(v.accepted ? t('accepted') : t('ignored')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('analysisError'))),
  });

  const suggestions = (report.data?.resolutionSuggestions ?? []).slice(0, 3);
  if (report.isLoading || suggestions.length === 0) return null;

  return (
    <div>
      <div className="mb-sm flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim"><Sparkles className="h-3.5 w-3.5 text-primary" /> {t('smartRecommendations')}</p>
        <button type="button" onClick={onOpenIntelligence} className="text-xs text-primary hover:underline">{t('viewFullAnalysis')}</button>
      </div>
      <div className="flex flex-col gap-sm">
        {suggestions.map((r) => {
          const state = handled[r.resolutionId];
          return (
            <div key={r.resolutionId} className={cn('card-surface flex items-center gap-sm p-md transition-opacity', state === 'ignored' && 'opacity-50')}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Lightbulb className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.summary}</p>
                <p className="text-xs text-dim">{pct(r.similarityScore)} {t('similar')} · {pct(r.successRate)} {t('success')}{r.reusedCount > 0 ? ` · ${r.reusedCount}× ${t('reuse')}` : ''}</p>
              </div>
              {state ? (
                <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-semibold', state === 'accepted' ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim')}>{state === 'accepted' ? t('accepted') : t('ignored')}</span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: true })} disabled={feedback.isPending} className="grid h-7 w-7 place-items-center rounded-md text-success hover:bg-success/10" aria-label={t('accepted')}><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: false })} disabled={feedback.isPending} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-panel-2" aria-label={t('ignored')}><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Iteration Control (header dropdown — iteration only) ---- */
function IterationControl({ ticketId, ticketTitle, ticketDescription, currentIteration, currentIterationId }: { ticketId: number; ticketTitle: string; ticketDescription: string; currentIteration: IterationResponse | null; currentIterationId: number | null }) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const iterations = useQuery({ queryKey: ['iterations'], queryFn: () => iterationsApi.list(1, 100) });

  // Determine current iteration from either the full object or fallback lookup by ID
  const resolvedIteration = currentIteration ?? (currentIterationId ? (iterations.data ?? []).find(it => it.id === currentIterationId) ?? null : null);

  const setIteration = useMutation({
    mutationFn: (iterationId: number | null) => ticketsApi.setIteration(ticketId, ticketTitle, ticketDescription, iterationId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); toast.success(t('iterationUpdated')); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Error')),
  });

  const iterationStatusLabel = (status: string) => {
    switch (status) {
      case 'Active': return 'Active';
      case 'Planning': return 'Planning';
      case 'Closed': return 'Closed';
      default: return status;
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-semibold transition-colors',
          resolvedIteration
            ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15'
            : 'border border-dashed border-border bg-panel text-muted hover:border-border-strong hover:text-text'
        )}
      >
        <Layers className="h-4 w-4" />
        {resolvedIteration ? (
          <span className="flex items-center gap-1.5">
            <span>{resolvedIteration.name}</span>
            {resolvedIteration.startDate && (
              <span className="text-[10px] font-normal opacity-70">
                {new Date(resolvedIteration.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                {resolvedIteration.endDate && <> – {new Date(resolvedIteration.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</>}
              </span>
            )}
          </span>
        ) : (
          t('iteration')
        )}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-1 w-72 rounded-lg border border-border bg-panel shadow-xl overflow-hidden">
            <div className="p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-dim mb-2">{t('iteration')}</p>
              <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => { setIteration.mutate(null); setOpen(false); }}
                  className={cn('flex items-center gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors hover:bg-bg-subtle', !resolvedIteration && 'bg-primary/10 text-primary font-medium')}
                >
                  <X className="h-3 w-3" /> {t('noIteration')}
                </button>
                {(iterations.data ?? []).map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => { setIteration.mutate(it.id); setOpen(false); }}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-xs text-left transition-colors hover:bg-bg-subtle',
                      resolvedIteration?.id === it.id && 'bg-primary/10 text-primary font-medium'
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {resolvedIteration?.id === it.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                      <span className="truncate">{it.name}</span>
                    </div>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      it.status === 'Active' ? 'bg-success/15 text-success' :
                      it.status === 'Planning' ? 'bg-blue-100 text-blue-700' :
                      'bg-panel-2 text-dim'
                    )}>{iterationStatusLabel(it.status)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---- Tags Bar (inline chips in header, to the right of "Atualizado em") ---- */
function TagsBar({ ticketId, currentTags }: { ticketId: number; currentTags: TagResponse[] }) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const MAX_TAGS = 5;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const allTags = useQuery({ queryKey: ['tags'], queryFn: () => tagsApi.list() });
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); qc.invalidateQueries({ queryKey: ['tags'] }); };

  const addTag = useMutation({
    mutationFn: (tagId: number) => tagsApi.addToTicket(ticketId, tagId),
    onSuccess: () => { invalidate(); setInput(''); },
    onError: (err) => {
      const msg = (err instanceof ApiError && err.message?.toLowerCase().includes('already')) ? t('tagAlreadyAssigned') : apiErrorMessage(err, t('tagAddError'));
      toast.error(msg);
    },
  });

  const createAndAdd = useMutation({
    mutationFn: async (name: string) => {
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
      const color = colors[name.length % colors.length];
      const created = await tagsApi.create({ name, color });
      await tagsApi.addToTicket(ticketId, created.id);
      return created;
    },
    onSuccess: () => { invalidate(); setInput(''); setOpen(false); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Error')),
  });

  const removeTag = useMutation({
    mutationFn: (tagId: number) => tagsApi.removeFromTicket(ticketId, tagId),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err, 'Error')),
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 50); }, [open]);

  const currentTagIds = new Set(currentTags.map((tg) => tg.id));
  const trimmed = input.trim().toLowerCase();
  const suggestions = (allTags.data ?? []).filter((tg) => tg.active && !currentTagIds.has(tg.id) && (!trimmed || tg.name.toLowerCase().includes(trimmed))).slice(0, 6);
  const exactMatch = suggestions.find((tg) => tg.name.toLowerCase() === trimmed);

  const handleSubmit = () => {
    if (!trimmed) return;
    if (exactMatch) addTag.mutate(exactMatch.id);
    else {
      const existing = (allTags.data ?? []).find((tg) => tg.name.toLowerCase() === trimmed && !currentTagIds.has(tg.id));
      if (existing) addTag.mutate(existing.id);
      else createAndAdd.mutate(input.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setInput(''); setOpen(false); }
  };

  const atLimit = currentTags.length >= MAX_TAGS;

  return (
    <span className="inline-flex items-center gap-1.5">
      {currentTags.map((tag) => (
        <span key={tag.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border" style={{ borderColor: (tag.color ?? '#888') + '40', backgroundColor: (tag.color ?? '#888') + '15', color: tag.color ?? '#888' }}>
          {tag.name}
          <button type="button" onClick={() => removeTag.mutate(tag.id)} className="hover:opacity-70 rounded-full p-0.5 -mr-1"><X className="h-2.5 w-2.5" /></button>
        </span>
      ))}
      {!atLimit && (
        <span className="relative inline-flex" ref={popRef}>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-1.5 h-7 rounded-md border border-dashed border-dim px-2 text-[11px] font-medium text-dim hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>{t('addTag')}</span>
          </button>
          {open && (
            <div className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-lg border border-border bg-panel shadow-xl overflow-hidden">
              <div className="p-2 border-b border-border">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t('tagsPlaceholder')}
                  className="w-full rounded-md border border-border bg-bg-subtle px-2.5 py-1.5 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-dim"
                />
              </div>
              <div className="max-h-[180px] overflow-y-auto">
                {suggestions.map((tag) => (
                  <button key={tag.id} type="button" onClick={() => { addTag.mutate(tag.id); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-bg-subtle transition-colors">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color ?? '#888' }} />
                    <span className="truncate">{tag.name}</span>
                  </button>
                ))}
              </div>
              {trimmed && !exactMatch && (
                <button type="button" onClick={() => createAndAdd.mutate(input.trim())} className="flex items-center gap-2 w-full border-t border-border px-3 py-2 text-xs text-left text-primary font-medium hover:bg-primary/5 transition-colors">
                  <Plus className="h-3 w-3" /> {t('createTag')} &ldquo;{input.trim()}&rdquo;
                </button>
              )}
              {(addTag.isPending || createAndAdd.isPending) && (
                <div className="flex items-center justify-center py-2 border-t border-border"><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /></div>
              )}
            </div>
          )}
        </span>
      )}
    </span>
  );
}

/* ---- Symptoms Bar ---- */
function SymptomsBar({ ticketId, currentSymptoms }: { ticketId: number; currentSymptoms: SymptomTagResponse[] }) {
  const t = useTranslations('ticket');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const popRef = useRef<HTMLDivElement>(null);

  const catalog = useQuery({ queryKey: ['symptoms'], queryFn: () => symptomsApi.list() });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });

  const add = useMutation({
    mutationFn: (symptomTagId: number) => ticketSymptomsApi.add(ticketId, { symptomTagId }),
    onSuccess: () => { invalidate(); toast.success(t('symptomAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('symptomError'))),
  });

  const remove = useMutation({
    mutationFn: (symptomTagId: number) => ticketSymptomsApi.remove(ticketId, symptomTagId),
    onSuccess: () => { invalidate(); toast.success(t('symptomRemoved')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('symptomError'))),
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentIds = new Set(currentSymptoms.map(s => s.id));
  const trimmed = filter.trim().toLowerCase();
  const available = (catalog.data ?? []).filter(s => !currentIds.has(s.id) && (!trimmed || s.name.toLowerCase().includes(trimmed) || s.code.toLowerCase().includes(trimmed)));
  const groups = [...new Set(available.map(s => s.group))].sort();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {currentSymptoms.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-warning/30 bg-warning/10 text-warning">
          {s.name}
          <button type="button" onClick={() => remove.mutate(s.id)} className="hover:opacity-70 rounded-full p-0.5 -mr-1"><X className="h-2.5 w-2.5" /></button>
        </span>
      ))}
      <div className="relative" ref={popRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center gap-1.5 h-7 rounded-md border border-dashed border-dim px-2 text-[11px] font-medium text-dim hover:border-warning hover:text-warning hover:bg-warning/5 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>{t('addSymptom')}</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-lg border border-border bg-panel shadow-xl overflow-hidden">
            <div className="p-2 border-b border-border">
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('addSymptom')}
                autoFocus
                className="w-full rounded-md border border-border bg-bg-subtle px-2.5 py-1.5 text-xs text-text outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 placeholder:text-dim"
              />
            </div>
            <div className="max-h-[220px] overflow-y-auto">
              {available.length === 0 ? (
                <p className="px-3 py-4 text-xs text-dim text-center">{t('noResults' as 'addSymptom')}</p>
              ) : (
                groups.map(group => (
                  <div key={group}>
                    {groups.length > 1 && <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase text-dim">{group}</p>}
                    {available.filter(s => s.group === group).map(s => (
                      <button key={s.id} type="button" onClick={() => { add.mutate(s.id); setOpen(false); }} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left hover:bg-bg-subtle transition-colors">
                        <span className="h-2 w-2 rounded-full bg-warning/60 shrink-0" />
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-[10px] text-dim">{s.code}</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Resolve Modal (4 steps: Root Cause → Symptoms → Resolution + Actions → Confirm) ---- */
const ACTION_TYPES = [
  { value: 1, key: 'fix' },
  { value: 2, key: 'workaround' },
  { value: 3, key: 'configuration' },
  { value: 4, key: 'restart' },
  { value: 5, key: 'escalation' },
  { value: 6, key: 'documentation' },
  { value: 7, key: 'other' },
] as const;

function SymptomsStep({ symptomCatalog, selectedIds, onToggle, onCreated, symptomName, t }: {
  symptomCatalog: SymptomTagResponse[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onCreated: (s: SymptomTagResponse) => void;
  symptomName: (id: number) => string;
  t: ReturnType<typeof useTranslations<'resolution'>>;
}) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const createSymptom = useMutation({
    mutationFn: (name: string) => symptomsApi.create({ name, code: name.toUpperCase().replace(/\s+/g, '_').slice(0, 30), group: 'General' }),
    onSuccess: (data) => { onCreated(data); setSearch(''); setCreating(false); toast.success(t('symptomCreated')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('symptomCreateError'))),
  });

  const query = search.trim().toLowerCase();
  const filtered = query ? symptomCatalog.filter(s =>
    s.name.toLowerCase().includes(query) || s.code.toLowerCase().includes(query)
  ).slice(0, 8) : [];
  const exactMatch = symptomCatalog.some(s => s.name.toLowerCase() === query);

  return (
    <div className="flex flex-col gap-md">
      <p className="text-xs text-muted">{t('selectSymptomsHint')}</p>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map(id => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border border-warning/30 bg-warning/10 text-warning">
              {symptomName(id)}
              <button type="button" onClick={() => onToggle(id)} className="hover:opacity-70 rounded-full p-0.5 -mr-1"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-dim" />
        <input
          className="w-full rounded-lg border border-border bg-bg-subtle py-2 pl-8 pr-3 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          placeholder={t('searchOrCreate')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && query && !exactMatch) { e.preventDefault(); createSymptom.mutate(search.trim()); } }}
        />
      </div>
      {!query && (
        <p className="text-xs text-dim text-center py-4">{t('typeToSearch')}</p>
      )}
      {query && (
        <div className="max-h-[220px] overflow-y-auto rounded-lg border border-border">
          {filtered.map(s => {
            const selected = selectedIds.includes(s.id);
            return (
              <button key={s.id} type="button" onClick={() => { onToggle(s.id); setSearch(''); }}
                className={cn('flex items-center gap-3 w-full px-3 py-2.5 text-xs text-left border-b border-border last:border-0 transition-colors',
                  selected ? 'bg-warning/5' : 'hover:bg-bg-subtle')}>
                <div className={cn('grid h-5 w-5 shrink-0 place-items-center rounded border transition-colors',
                  selected ? 'bg-warning border-warning text-white' : 'border-border')}>
                  {selected && <Check className="h-3 w-3" />}
                </div>
                <span className="flex-1">{s.name}</span>
                <span className="text-[10px] text-dim">{s.code}</span>
              </button>
            );
          })}
          {!exactMatch && (
            <button type="button" onClick={() => createSymptom.mutate(search.trim())} disabled={createSymptom.isPending}
              className="flex items-center gap-2 w-full px-3 py-2.5 text-xs text-left border-t border-border hover:bg-bg-subtle transition-colors">
              <Plus className="h-3.5 w-3.5 text-primary" />
              <span className="text-primary font-medium">{t('createSymptom', { name: search.trim() })}</span>
              {createSymptom.isPending && <Loader2 className="h-3 w-3 animate-spin ml-auto" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ResolveModal({ ticketId, ticketTitle, ticketSymptoms, onClose, onResolved }: { ticketId: number; ticketTitle: string; ticketSymptoms: SymptomTagResponse[]; onClose: () => void; onResolved: () => void }) {
  const t = useTranslations('resolution');
  const tIntel = useTranslations('intelligence');
  const tTicket = useTranslations('ticket');
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [rootCauseTitle, setRootCauseTitle] = useState('');
  const [rootCauseSummary, setRootCauseSummary] = useState('');
  const [rootCauseCategory, setRootCauseCategory] = useState<RootCauseCategoryValue>(RootCauseCategory.Bug);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedRootCauseId, setSelectedRootCauseId] = useState<number | null>(null);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<number[]>(ticketSymptoms.map(s => s.id));
  const [actions, setActions] = useState<{ actionType: number; detail: string }[]>([]);

  const symptomCatalog = useQuery({ queryKey: ['symptoms'], queryFn: () => symptomsApi.list() });
  const rootCauses = useQuery({ queryKey: ['rootcauses', ticketId], queryFn: () => rootCausesApi.byTicket(ticketId) });
  const report = useQuery({ queryKey: ['tickets', 'intelligence', ticketId], queryFn: () => intelligenceApi.ticketReport(ticketId), retry: false });

  const resolve = useMutation({
    mutationFn: () =>
      ticketsApi.resolve(ticketId, {
        rootCauseTitle: selectedRootCauseId ? (rootCauses.data?.find(r => r.id === selectedRootCauseId)?.title ?? rootCauseTitle) : rootCauseTitle,
        rootCauseSummary: selectedRootCauseId ? (rootCauses.data?.find(r => r.id === selectedRootCauseId)?.description ?? rootCauseSummary) : rootCauseSummary,
        rootCauseCategory,
        resolutionSummary: resolutionSummary.trim(),
        outcome: outcome.trim(),
        actions: actions.map((a, i) => ({ order: i + 1, actionType: a.actionType, detail: a.detail.trim() || null })),
        symptomTagIds: selectedSymptomIds,
        isRecurring,
      }),
    onSuccess: () => { toast.success(t('resolvedOk')); onResolved(); },
    onError: (err) => toast.error(apiErrorMessage(err, t('resolveError'))),
  });

  const aiSuggestions = report.data?.resolutionSuggestions ?? [];
  const aiRootCauses = report.data?.rootCauseCandidates ?? [];

  const toggleSymptom = (id: number) => {
    setSelectedSymptomIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const addAction = () => setActions(prev => [...prev, { actionType: 1, detail: '' }]);
  const removeAction = (idx: number) => setActions(prev => prev.filter((_, i) => i !== idx));
  const updateAction = (idx: number, field: 'actionType' | 'detail', val: number | string) => {
    setActions(prev => prev.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const canNext =
    step === 0 ? (selectedRootCauseId || rootCauseTitle.trim()) :
    step === 1 ? true :
    step === 2 ? resolutionSummary.trim() :
    true;

  const LAST_STEP = 3;
  const steps = [
    { label: t('stepRootCause'), icon: Target },
    { label: t('stepSymptoms'), icon: AlertTriangle },
    { label: t('stepResolution'), icon: Zap },
    { label: t('stepConfirm'), icon: Check },
  ];

  const symptomName = (id: number) => {
    const found = (symptomCatalog.data ?? []).find(s => s.id === id) ?? ticketSymptoms.find(s => s.id === id);
    return found?.name ?? `#${id}`;
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-xl border border-border bg-panel shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-panel px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-success/15">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <h2 className="text-lg font-bold">{t('resolveTicket')}</h2>
                <p className="text-xs text-dim">{ticketTitle}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-md hover:bg-bg-subtle"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-6 flex flex-col gap-5">
            {/* Wizard stepper */}
            <div className="flex items-center">
              {steps.map((s, i) => {
                const StepIcon = s.icon;
                const done = i < step;
                const active = i === step;
                return (
                  <div key={i} className="flex items-center flex-1 last:flex-none">
                    <button type="button" onClick={() => done && setStep(i)} className={cn('flex items-center gap-2', done && 'cursor-pointer')}>
                      <span className={cn(
                        'grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-all',
                        active ? 'bg-primary text-white shadow-md shadow-primary/30' :
                        done ? 'bg-success text-white' :
                        'bg-panel-2 text-dim border border-border'
                      )}>
                        {done ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                      </span>
                      <span className={cn('text-xs font-medium hidden sm:block', active ? 'text-text' : done ? 'text-success' : 'text-dim')}>{s.label}</span>
                    </button>
                    {i < steps.length - 1 && <div className={cn('mx-3 h-px flex-1', done ? 'bg-success' : 'bg-border')} />}
                  </div>
                );
              })}
            </div>

            {/* AI context — read-only pattern analysis (NOT root cause suggestions) */}
            {aiRootCauses.length > 0 && step === 0 && (
              <div className="rounded-lg border border-border bg-panel-2/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="h-3.5 w-3.5 text-dim" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-dim">{tIntel('patternContext')}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {aiRootCauses.slice(0, 3).map((rc, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-muted">
                      <span className="shrink-0 rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{rc.category}</span>
                      <p className="leading-relaxed">{rc.description}</p>
                      {rc.supportingTicketIds.length > 0 && (
                        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{rc.supportingTicketIds.length} similar</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Resolution suggestions */}
            {aiSuggestions.length > 0 && step === 2 && (
              <div className="rounded-xl border border-success/20 bg-gradient-to-br from-success/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-success" />
                  <p className="text-xs font-semibold uppercase text-success">{tIntel('smartRecommendations')}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {aiSuggestions.slice(0, 3).map((s) => (
                    <button key={s.resolutionId} type="button" onClick={() => setResolutionSummary(s.summary)}
                      className={cn('flex flex-col gap-2 rounded-lg border p-3 text-left text-xs transition-all hover:border-success/40',
                        resolutionSummary === s.summary ? 'border-success bg-success/5 ring-1 ring-success/20' : 'border-border bg-panel/60')}>
                      <div className="flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-success shrink-0" />
                        <p className="font-semibold text-text flex-1">{s.summary}</p>
                        {resolutionSummary === s.summary && <Check className="h-4 w-4 text-success shrink-0" />}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">{pct(s.successRate)} {tIntel('success')}</span>
                        {s.reusedCount > 0 && <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] text-dim">{s.reusedCount}× {tIntel('reuse')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 0: Root Cause */}
            {step === 0 && (
              <div className="flex flex-col gap-md">
                {(rootCauses.data?.length ?? 0) > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-dim uppercase tracking-wide">{t('existingCauses')}</p>
                    {rootCauses.data!.map((rc) => (
                      <button key={rc.id} type="button" onClick={() => { setSelectedRootCauseId(rc.id === selectedRootCauseId ? null : rc.id); setRootCauseTitle(''); }}
                        className={cn('flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                          selectedRootCauseId === rc.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-border-strong')}>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">{Math.round(rc.confidenceScore * 100)}%</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{rc.title}</p>
                          <p className="text-xs text-dim truncate">{rc.category} · {rc.description}</p>
                        </div>
                        {selectedRootCauseId === rc.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    ))}
                    <div className="flex items-center gap-2 py-1">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] uppercase text-dim">{t('orCreateNew')}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  </div>
                )}
                {!selectedRootCauseId && (
                  <div className="flex flex-col gap-md">
                    <div className="grid gap-md md:grid-cols-2">
                      <label className="flex flex-col gap-1.5 text-xs text-muted">
                        <span className="font-medium">{t('causeTitle')}</span>
                        <input className={FIELD_MD} value={rootCauseTitle} onChange={(e) => setRootCauseTitle(e.target.value)} placeholder={t('causeTitlePh')} />
                      </label>
                      <label className="flex flex-col gap-1.5 text-xs text-muted">
                        <span className="font-medium">{t('category')}</span>
                        <Select<RootCauseCategoryValue> value={rootCauseCategory} onChange={setRootCauseCategory} options={Object.entries(RootCauseCategory).map(([k, v]) => ({ value: v as RootCauseCategoryValue, label: k }))} />
                      </label>
                    </div>
                    <label className="flex flex-col gap-1.5 text-xs text-muted">
                      <span className="font-medium">{t('causeSummary')}</span>
                      <textarea className={FIELD_BASE + ' h-20 resize-none'} value={rootCauseSummary} onChange={(e) => setRootCauseSummary(e.target.value)} placeholder={t('causeSummaryPh')} />
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Symptoms */}
            {step === 1 && (
              <SymptomsStep
                symptomCatalog={symptomCatalog.data ?? []}
                selectedIds={selectedSymptomIds}
                onToggle={toggleSymptom}
                onCreated={(s) => { qc.invalidateQueries({ queryKey: ['symptoms'] }); setSelectedSymptomIds(prev => [...prev, s.id]); }}
                symptomName={symptomName}
                t={t}
              />
            )}

            {/* Step 2: Resolution + Actions */}
            {step === 2 && (
              <div className="flex flex-col gap-md">
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  <span className="font-medium">{t('resolutionSummary')}</span>
                  <textarea className={FIELD_BASE + ' h-28 resize-none'} value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} placeholder={t('resolutionSummaryPh')} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  <span className="font-medium">{t('outcome')}</span>
                  <input className={FIELD_MD} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={t('outcomePh')} />
                </label>
                <Checkbox checked={isRecurring} onChange={(e) => setIsRecurring(e.currentTarget.checked)} label={<span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" />{t('isRecurring')}</span>} size="sm" />

                {/* Actions */}
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">{t('actions')}</p>
                    <Button type="button" size="sm" variant="secondary" onClick={addAction} className="h-7 text-xs">
                      <Plus className="h-3 w-3" /> {t('addAction')}
                    </Button>
                  </div>
                  {actions.length === 0 && <p className="text-xs text-dim italic">{t('noActions')}</p>}
                  {actions.map((a, idx) => (
                    <div key={idx} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-panel-2 text-[10px] font-bold text-dim mt-0.5">{idx + 1}</span>
                      <div className="flex-1 flex flex-col gap-1.5">
                        <Select<number> value={a.actionType} onChange={(v) => updateAction(idx, 'actionType', v)} options={ACTION_TYPES.map(at => ({ value: at.value, label: t(`actionTypes.${at.key}` as 'actionType') }))} />
                        <input className={FIELD_SM} value={a.detail} onChange={(e) => updateAction(idx, 'detail', e.target.value)} placeholder={t('actionDetailPh')} />
                      </div>
                      <button type="button" onClick={() => removeAction(idx)} className="shrink-0 rounded p-1 text-dim hover:text-danger hover:bg-danger/10 mt-0.5"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <div className="rounded-lg border border-border bg-bg-subtle/50 p-4 flex flex-col gap-3 text-sm">
                <div className="flex items-start gap-2">
                  <Target className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium uppercase text-dim">{t('rootCause')}</p>
                    <p className="font-medium">{selectedRootCauseId ? rootCauses.data?.find(r => r.id === selectedRootCauseId)?.title : rootCauseTitle}</p>
                  </div>
                </div>
                {selectedSymptomIds.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase text-dim">{t('stepSymptoms')}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedSymptomIds.map(id => (
                          <span key={id} className="rounded-full bg-warning/10 border border-warning/20 px-2 py-0.5 text-[11px] text-warning">{symptomName(id)}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium uppercase text-dim">{t('resolution')}</p>
                    <p>{resolutionSummary}</p>
                  </div>
                </div>
                {outcome && (
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase text-dim">{t('outcome')}</p>
                      <p>{outcome}</p>
                    </div>
                  </div>
                )}
                {actions.length > 0 && (
                  <div className="flex items-start gap-2">
                    <ListChecks className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] font-medium uppercase text-dim">{t('actions')}</p>
                      <ol className="mt-1 list-decimal list-inside text-xs text-muted space-y-0.5">
                        {actions.map((a, i) => (
                          <li key={i}><span className="font-medium text-text">{ACTION_TYPES.find(at => at.value === a.actionType)?.key}</span>{a.detail && ` — ${a.detail}`}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
                {isRecurring && (
                  <div className="rounded bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning flex items-center gap-2">
                    <RotateCcw className="h-3.5 w-3.5" /> {t('markedRecurring')}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-between border-t border-border bg-panel px-6 py-4">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
              {t('back')}
            </Button>
            {step < LAST_STEP ? (
              <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
                {t('next')} <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => resolve.mutate()} loading={resolve.isPending} className="bg-success hover:bg-success/90">
                <Zap className="h-4 w-4" /> {t('resolveTicket')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
}

/* ---- Worklogs ---- */
function useWorklogTypes() {
  const t = useTranslations('worklogType');
  return [
    { value: 1, label: t('investigation') }, { value: 2, label: t('meeting') }, { value: 3, label: t('development') },
    { value: 4, label: t('validation') }, { value: 5, label: t('customerSupport') }, { value: 6, label: t('documentation') }, { value: 7, label: t('other') },
  ];
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

function WorklogsTab({ ticketId, worklogs, userName, estimateMinutesServer, remainingMinutesServer, completedMinutesServer }: { ticketId: number; worklogs: { id: number; userId: number; type: string; description: string; durationMinutes: number; startedAt: string | null }[]; userName: (id: number | null) => string; estimateMinutesServer: number | null; remainingMinutesServer: number | null; completedMinutesServer: number }) {
  const t = useTranslations('worklog');
  const tType = useTranslations('worklogType');
  const types = useWorklogTypes();
  const translateType = (raw: string) => {
    try { return tType(raw as any); } catch { return raw; }
  };
  const qc = useQueryClient();
  const [type, setType] = useState(3);
  const [description, setDescription] = useState('');
  const [timeInput, setTimeInput] = useState('0:00');
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(() => new Set(worklogs.map(w => w.userId)));

  const totalMin = completedMinutesServer || worklogs.reduce((acc, w) => acc + (w.durationMinutes || 0), 0);
  const estimateMin = Math.max(0, estimateMinutesServer ?? 0);
  const remainingMin = remainingMinutesServer != null ? Math.max(0, remainingMinutesServer) : Math.max(0, estimateMin - totalMin);
  const progress = estimateMin > 0 ? Math.min(100, (totalMin / estimateMin) * 100) : 0;

  const parseTimeInput = (val: string): number => {
    const parts = val.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  };

  const duration = parseTimeInput(timeInput);

  const usersMap = new Map<number, { userId: number; worklogs: typeof worklogs; totalMin: number }>();
  worklogs.forEach((w) => {
    if (!usersMap.has(w.userId)) usersMap.set(w.userId, { userId: w.userId, worklogs: [], totalMin: 0 });
    const userData = usersMap.get(w.userId)!;
    userData.worklogs.push(w);
    userData.totalMin += w.durationMinutes || 0;
  });

  const usersColumns = Array.from(usersMap.values()).sort((a, b) => b.totalMin - a.totalMin);

  const log = useMutation({
    mutationFn: async () => {
      const created = await worklogsApi.create(ticketId, { type, description: description.trim(), startedAt: new Date().toISOString() });
      await worklogsApi.updateDuration(created.id, duration);
      return created;
    },
    onSuccess: () => { toast.success(t('loggedOk')); setDescription(''); setTimeInput('0:00'); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('logError'))),
  });

  const deleteWorklog = useMutation({
    mutationFn: (worklogId: number) => worklogsApi.remove(worklogId),
    onSuccess: () => { toast.success(t('worklogRemoved')); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('worklogRemoveError'))),
  });

  const canLog = description.trim().length > 0 && duration > 0;

  const toggleUser = (userId: number) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const handleTimeChange = (val: string) => {
    const cleaned = val.replace(/[^0-9:]/g, '');
    setTimeInput(cleaned);
  };

  const handleTimeBlur = () => {
    const parts = timeInput.split(':');
    if (parts.length !== 2 || isNaN(parseInt(parts[0])) || isNaN(parseInt(parts[1]))) {
      setTimeInput('0:00');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
      <div>
        <div className="card-surface overflow-hidden">
          {/* Header stats */}
          <div className="p-lg pb-md">
            <div className="flex items-center justify-between mb-md">
              <h3 className="text-sm font-semibold">{t('timeTracking')}</h3>
              {estimateMin > 0 && (
                <span className={cn('text-xs font-bold tabular-nums px-2 py-0.5 rounded-full', totalMin > estimateMin ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary')}>
                  {Math.round(progress)}%
                </span>
              )}
            </div>

            {/* Ring + stats */}
            <div className="flex items-center gap-4 mb-md">
              {/* SVG ring */}
              <div className="shrink-0">
                {(() => {
                  const r = 28, circ = 2 * Math.PI * r;
                  const pct = estimateMin > 0 ? Math.min(1, totalMin / estimateMin) : 0;
                  const over = totalMin > estimateMin;
                  return (
                    <svg width="72" height="72" viewBox="0 0 72 72">
                      <circle cx="36" cy="36" r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth="8" />
                      {pct > 0 && (
                        <circle
                          cx="36" cy="36" r={r} fill="none"
                          stroke={over ? 'var(--color-danger)' : 'var(--color-primary)'}
                          strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
                          transform="rotate(-90 36 36)"
                          style={{ transition: 'stroke-dashoffset .4s ease' }}
                        />
                      )}
                      <text x="36" y="40" textAnchor="middle" fontSize="11" fontWeight="700" fill={over ? 'var(--color-danger)' : 'var(--color-text)'}>
                        {fmtMin(totalMin)}
                      </text>
                    </svg>
                  );
                })()}
              </div>
              {/* Stats */}
              <div className="flex flex-col gap-2 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-dim">{t('estimate')}</span>
                  <span className="font-semibold tabular-nums">{estimateMin > 0 ? fmtMin(estimateMin) : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">{t('completed')}</span>
                  <span className="font-semibold tabular-nums text-primary">{fmtMin(totalMin)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-dim">{t('remaining')}</span>
                  <span className={cn('font-semibold tabular-nums', totalMin > estimateMin ? 'text-danger' : 'text-text')}>
                    {estimateMin > 0 ? fmtMin(remainingMin) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {estimateMin > 0 && (
              <div className="h-1 overflow-hidden rounded-full bg-panel-2 mb-md">
                <div className={cn('h-full rounded-full transition-all duration-500', totalMin > estimateMin ? 'bg-danger' : 'bg-primary')} style={{ width: `${Math.min(100, progress)}%` }} />
              </div>
            )}
          </div>

          {/* Log form */}
          <Can permission="worklog.create">
            <div className="border-t border-border bg-panel-2/20 px-lg py-md">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-dim">{t('addLog')}</p>
              <form onSubmit={(e) => { e.preventDefault(); if (canLog) log.mutate(); }} className="flex flex-col gap-2.5">
                <Select value={type} onChange={setType} options={types} />
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPh')} />
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { const d = parseTimeInput(timeInput); const m = Math.max(0, d - 15); setTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-8 w-8 shrink-0 place-items-center rounded border border-border hover:bg-panel-2 text-dim"><Minus className="h-3 w-3" /></button>
                  <Input value={timeInput} onChange={(e) => handleTimeChange(e.target.value)} onBlur={handleTimeBlur} placeholder="1:30" className="h-8 text-xs text-center flex-1" />
                  <button type="button" onClick={() => { const d = parseTimeInput(timeInput); const m = d + 15; setTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-8 w-8 shrink-0 place-items-center rounded border border-border hover:bg-panel-2 text-dim"><Plus className="h-3 w-3" /></button>
                  <Button type="submit" disabled={!canLog} loading={log.isPending} className="shrink-0 h-8 px-4 text-xs">
                    {t('log')}
                  </Button>
                </div>
              </form>
            </div>
          </Can>
        </div>
      </div>

      <div>
        {usersColumns.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12 text-dim">
            <Clock className="h-10 w-10" />
            <p className="text-xs">{t('emptyPerson')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {usersColumns.map((userCol) => {
              const isExpanded = expandedUsers.has(userCol.userId);
              return (
                <div key={userCol.userId} className="card-surface">
                  <button type="button" onClick={() => toggleUser(userCol.userId)} className="flex items-center gap-2 px-3 py-2.5 w-full text-left hover:bg-panel-2/50 transition-colors">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-fg">{initials(userName(userCol.userId)) || '?'}</span>
                    <span className="text-xs font-semibold truncate flex-1">{userName(userCol.userId)}</span>
                    <span className="text-xs font-medium text-primary tabular-nums">{fmtMin(userCol.totalMin)}</span>
                    <ChevronRight className={cn('h-3.5 w-3.5 text-dim transition-transform', isExpanded && 'rotate-90')} />
                  </button>
                  {isExpanded && (
                    <div className="border-t border-border">
                      {userCol.worklogs.map((w) => (
                        <div key={w.id} className="flex items-center gap-2 px-3 py-2 hover:bg-panel-2/30 transition-colors group border-b border-border/50 last:border-b-0">
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary w-[88px] text-center inline-block truncate">{translateType(w.type)}</span>
                            <span className="text-[11px] truncate">{w.description || '—'}</span>
                          </div>
                          <span className="shrink-0 text-[10px] text-dim">{w.startedAt ? new Date(w.startedAt).toLocaleDateString() : ''}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-primary tabular-nums w-12 text-right">{fmtMin(w.durationMinutes)}</span>
                          <button type="button" onClick={() => deleteWorklog.mutate(w.id)} disabled={deleteWorklog.isPending} className="shrink-0 rounded p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all disabled:opacity-50">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- Attachment Grid (reusable) ---- */
function AttachmentGrid({ attachments, thumbnailUrls, loadingThumbnails, failedThumbnails, onPreview, onDownload, onDelete, deleting, locale, timeZone, t }: {
  attachments: TicketAttachmentResponse[];
  thumbnailUrls: Record<number, string>;
  loadingThumbnails: Set<number>;
  failedThumbnails: Set<number>;
  onPreview: (a: TicketAttachmentResponse) => void;
  onDownload: (a: TicketAttachmentResponse) => void;
  onDelete: (id: number) => void;
  deleting: boolean;
  locale: Locale;
  timeZone: string;
  t: ReturnType<typeof useTranslations<'attachments'>>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {attachments.map((a) => {
        const isImg = isImage(a.contentType);
        const thumbUrl = thumbnailUrls[a.id];
        const isLoadingThumb = loadingThumbnails.has(a.id);
        const hasFailed = failedThumbnails.has(a.id);
        return (
          <div key={a.id} className="card-surface overflow-hidden group">
            <div className="relative bg-panel-2 flex items-center justify-center cursor-pointer h-28" onClick={() => isImg ? onPreview(a) : onDownload(a)}>
              {isImg && thumbUrl ? (
                <>
                  <img src={thumbUrl} alt={a.fileName} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : isImg && isLoadingThumb ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              ) : isImg && hasFailed ? (
                <FileText className="h-6 w-6 text-dim" />
              ) : isPdf(a.contentType) ? (
                <div className="flex flex-col items-center gap-1 text-dim"><FileText className="h-6 w-6" /><span className="text-[9px]">PDF</span></div>
              ) : (
                <div className="flex flex-col items-center gap-1 text-dim"><FileText className="h-6 w-6" /><span className="text-[9px] uppercase">{a.contentType.split('/')[1]?.slice(0, 4) || 'FILE'}</span></div>
              )}
            </div>
            <div className="px-2.5 py-2 flex items-start gap-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-tight" title={a.fileName}>{a.fileName}</p>
                <p className="text-[9px] text-dim">{fmtSize(a.fileSize)}</p>
                {a.createdAt && <p className="text-[9px] text-dim">{formatDateTime(a.createdAt, { locale, timeZone })}</p>}
              </div>
              <div className="flex shrink-0 gap-0.5">
                <button type="button" onClick={() => onDownload(a)} className="rounded p-0.5 text-muted hover:bg-panel-2 hover:text-text" title={t('download')}><Download className="h-3 w-3" /></button>
                <button type="button" onClick={() => onDelete(a.id)} disabled={deleting} className="rounded p-0.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50" title={t('delete')}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---- Attachments Tab ---- */
function AttachmentsTab({ ticketId, userName, investigations }: { ticketId: number; userName: (uid: number | null) => string; investigations: InvestigationResponse[] }) {
  const t = useTranslations('attachments');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<{ name: string; pct: number }[]>([]);
  const [preview, setPreview] = useState<{ att: TicketAttachmentResponse; url: string } | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<number, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<number>>(new Set());
  const [failedThumbnails, setFailedThumbnails] = useState<Set<number>>(new Set());

  const loadThumbnail = async (att: TicketAttachmentResponse) => {
    if (!isImage(att.contentType)) return;
    if (thumbnailUrls[att.id] || failedThumbnails.has(att.id) || loadingThumbnails.has(att.id)) return;
    
    setLoadingThumbnails((prev) => new Set(prev).add(att.id));
    try {
      const url = await fetchBlobUrl(att.id);
      setThumbnailUrls((prev) => ({ ...prev, [att.id]: url }));
    } catch {
      setFailedThumbnails((prev) => new Set(prev).add(att.id));
    } finally {
      setLoadingThumbnails((prev) => {
        const next = new Set(prev);
        next.delete(att.id);
        return next;
      });
    }
  };

  async function openPreview(a: TicketAttachmentResponse) {
    if (!canPreview(a.contentType)) {
      void downloadOne(a);
      return;
    }
    try {
      const url = thumbnailUrls[a.id] || await fetchBlobUrl(a.id);
      setPreview({ att: a, url });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('downloadError')));
    }
  }

  function closePreview() {
    if (preview && !thumbnailUrls[preview.att.id]) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tickets', 'attachments', ticketId],
    queryFn: () => ticketsApi.listAttachments(ticketId),
  });

  const prevDataRef = useRef<typeof data | null>(null);
  if (data && data !== prevDataRef.current) {
    (prevDataRef as { current: typeof data | null }).current = data;
    data.forEach((a) => {
      if (isImage(a.contentType)) loadThumbnail(a);
    });
  }

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const oversized = files.filter((f) => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        throw new Error(t('tooLarge', { files: oversized.map((f) => f.name).join(', ') }));
      }
      setUploading(files.map((f) => ({ name: f.name, pct: 0 })));
      for (const f of files) {
        await ticketsApi.uploadAttachment(ticketId, f);
        setUploading((prev) => prev.map((u) => (u.name === f.name ? { ...u, pct: 100 } : u)));
      }
    },
    onSuccess: () => {
      toast.success(t('uploadOk'));
      qc.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      setUploading([]);
      if (inputRef.current) inputRef.current.value = '';
    },
    onError: (err) => {
      toast.error(apiErrorMessage(err, t('uploadError')));
      setUploading([]);
    },
  });

  const deleteAttachment = useMutation({
    mutationFn: (attachmentId: number) => ticketsApi.removeAttachment(ticketId, attachmentId),
    onSuccess: (_data, attachmentId) => {
      toast.success(t('attachmentRemoved'));
      if (thumbnailUrls[attachmentId]) {
        URL.revokeObjectURL(thumbnailUrls[attachmentId]);
        setThumbnailUrls((prev) => {
          const next = { ...prev };
          delete next[attachmentId];
          return next;
        });
      }
      qc.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('attachmentRemoveError'))),
  });

  const onFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const arr = Array.from(files);
      if (arr.length === 0) return;
      upload.mutate(arr);
    },
    [upload],
  );

  const downloadOne = async (a: TicketAttachmentResponse) => {
    try {
      const url = ticketsApi.downloadAttachmentUrl(a.id);
      const accessToken = tokenStore.getAccessToken();
      const res = await fetch(url, {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objUrl;
      link.download = a.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objUrl);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('downloadError')));
    }
  };

  // Extract evidence attachments from investigations
  const allEvidences = investigations.flatMap(inv => inv.evidences.filter(ev => ev.filePath));
  const hasEvidences = allEvidences.length > 0;
  const hasRegularAttachments = data && data.length > 0;

  return (
    <div className="flex flex-col gap-lg">
      <Can permission="ticket.attach.add">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            onFiles(e.dataTransfer.files);
          }}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-lg text-center transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-panel/40',
          )}
        >
          <UploadCloud className={cn('h-7 w-7', dragOver ? 'text-primary' : 'text-dim')} />
          <p className="text-sm font-medium">{t('dropzone')}</p>
          <p className="text-xs text-dim">{t('maxSize')}</p>
          <Button size="sm" type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            <Paperclip className="h-4 w-4" /> {t('chooseFiles')}
          </Button>
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
          {uploading.length > 0 && (
            <ul className="mt-2 w-full max-w-md text-left text-xs text-muted">
              {uploading.map((u) => (
                <li key={u.name} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{u.name}</span>
                  <span>{u.pct}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Can>

      {/* Anexos do ticket */}
      {isLoading ? (
        <LoadingState label={t('loading')} />
      ) : (
        <>
          {hasRegularAttachments && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Paperclip className="h-4 w-4 text-dim" />
                <h3 className="text-xs font-semibold text-text">{t('regularSection')}</h3>
                <span className="rounded-full bg-panel-2 px-2 py-0.5 text-[10px] font-medium text-dim">{data!.length}</span>
              </div>
              <AttachmentGrid attachments={data!} thumbnailUrls={thumbnailUrls} loadingThumbnails={loadingThumbnails} failedThumbnails={failedThumbnails} onPreview={openPreview} onDownload={downloadOne} onDelete={(id) => deleteAttachment.mutate(id)} deleting={deleteAttachment.isPending} locale={locale} timeZone={timeZone} t={t} />
            </div>
          )}

          {hasEvidences && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <FlaskConical className="h-4 w-4 text-purple-500" />
                <h3 className="text-xs font-semibold text-text">{t('evidenceSection')}</h3>
                <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">{allEvidences.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {investigations.map((inv) =>
                  inv.evidences.filter(ev => ev.filePath).map((ev) => {
                    const fileName = ev.filePath?.split('/').pop() ?? ev.filePath ?? `Evidence ${ev.type}`;
                    return (
                      <div key={ev.id} className="card-surface flex items-center gap-2.5 px-3 py-2 border-l-2 border-l-purple-400">
                        <div className="shrink-0 grid h-7 w-7 place-items-center rounded-md bg-purple-50 dark:bg-purple-900/30">
                          <FileText className="h-3.5 w-3.5 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium truncate">{ev.notes || fileName}</p>
                          <p className="text-[9px] text-dim">
                            {ev.type}
                            {ev.fileSize > 0 ? ` · ${fmtSize(ev.fileSize)}` : ''}
                            {ev.createdAt ? ` · ${formatDateTime(ev.createdAt, { locale, timeZone })}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[9px] font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
                          {inv.summary ? inv.summary.slice(0, 20) + (inv.summary.length > 20 ? '…' : '') : `Inv. #${inv.id}`}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {!hasRegularAttachments && !hasEvidences && (
            <p className="text-sm text-dim">{t('empty')}</p>
          )}
        </>
      )}

      {preview && (
        <Portal>
          <div className="fixed inset-0 z-[120] flex flex-col bg-black/70 backdrop-blur-sm" onClick={closePreview}>
            <div className="flex items-center gap-sm border-b border-white/10 px-md py-2 text-sm text-white">
              <span className="flex-1 truncate">{preview.att.fileName}</span>
              <button type="button" onClick={(e) => { e.stopPropagation(); downloadOne(preview.att); }} className="rounded p-1.5 hover:bg-white/10" title={t('download')}>
                <Download className="h-4 w-4" />
              </button>
              <button type="button" onClick={closePreview} className="rounded p-1.5 hover:bg-white/10" aria-label={t('close')}>
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center p-md" onClick={(e) => e.stopPropagation()}>
              {isImage(preview.att.contentType) ? (
                <img src={preview.url} alt={preview.att.fileName} className="max-h-full max-w-full rounded object-contain" />
              ) : (
                <iframe src={preview.url} title={preview.att.fileName} className="h-full w-full rounded bg-white" />
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

/* ================================================================
   INVESTIGATION TAB - Painel de Análise Profissional
   ================================================================ */
function useEvidenceHints(): Record<EvidenceTypeValue, { ph: string; suggestions: string[]; needsUrl: boolean }> {
  const t = useTranslations('investigation');
  return {
    [EvidenceType.Screenshot]: { ph: t('evHint.screenshotPh'), suggestions: [t('evHint.screenshotS1'), t('evHint.screenshotS2'), t('evHint.screenshotS3')], needsUrl: false },
    [EvidenceType.Log]: { ph: t('evHint.logPh'), suggestions: [t('evHint.logS1'), t('evHint.logS2'), t('evHint.logS3')], needsUrl: false },
    [EvidenceType.Video]: { ph: t('evHint.videoPh'), suggestions: [t('evHint.videoS1'), t('evHint.videoS2')], needsUrl: true },
    [EvidenceType.File]: { ph: t('evHint.filePh'), suggestions: [t('evHint.fileS1'), t('evHint.fileS2')], needsUrl: false },
    [EvidenceType.Observation]: { ph: t('evHint.obsPh'), suggestions: [t('evHint.obsS1'), t('evHint.obsS2'), t('evHint.obsS3')], needsUrl: false },
    [EvidenceType.Url]: { ph: t('evHint.urlPh'), suggestions: [t('evHint.urlS1'), t('evHint.urlS2'), t('evHint.urlS3')], needsUrl: true },
  };
}

function EvidenceFileUpload({ investigationId, ticketId, evType, onDone }: { investigationId: number; ticketId: number; evType: EvidenceTypeValue; onDone: () => void }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) { toast.error(`Max ${fmtSize(MAX_FILE_SIZE)}`); return; }
    setUploading(true);
    try {
      await Promise.all([
        investigationsApi.uploadEvidence(investigationId, file, String(evType)),
        ticketsApi.uploadAttachment(ticketId, file),
      ]);
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      qc.invalidateQueries({ queryKey: ['tickets', 'attachments', ticketId] });
      onDone();
      toast.success(t('evidenceAdded'));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('saveError')));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
      <Button type="button" size="sm" variant="ghost" onClick={() => fileRef.current?.click()} disabled={uploading} className="h-7 text-xs gap-1 text-primary">
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UploadCloud className="h-3 w-3" />}
        {t('upload')}
      </Button>
    </>
  );
}

function InvestigationTab({ ticketId, investigations }: { ticketId: number; investigations: InvestigationResponse[] }) {
  const t = useTranslations('investigation');
  const tIntel = useTranslations('intelligence');
  const qc = useQueryClient();
  const [summary, setSummary] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(investigations.find(inv => !inv.finishedAt)?.id ?? null);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); qc.invalidateQueries({ queryKey: ['investigations'] }); };

  const report = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
    retry: false,
  });

  const create = useMutation({
    mutationFn: () => investigationsApi.create(ticketId, { summary: summary.trim() }),
    onSuccess: (data) => { setSummary(''); invalidate(); setExpandedId(data.id); toast.success(t('create')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const totalHypotheses = investigations.reduce((acc, inv) => acc + inv.hypotheses.length, 0);
  const totalFindings = investigations.reduce((acc, inv) => acc + inv.findingItems.length, 0);
  const totalEvidences = investigations.reduce((acc, inv) => acc + inv.evidences.length, 0);

  const aiCauses = report.data?.rootCauseCandidates ?? [];

  return (
    <div className="flex flex-col gap-lg">
      {/* Pattern context banner — informational, NOT root cause */}
      {aiCauses.length > 0 && (
        <div className="rounded-lg border border-border bg-panel-2/30 p-md">
          <div className="flex items-center gap-2 mb-2">
            <Layers className="h-3.5 w-3.5 text-dim" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-dim">{tIntel('patternContext')}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {aiCauses.slice(0, 3).map((rc, i) => (
              <div key={i} className="flex-1 min-w-[180px] rounded-lg border border-border bg-panel/80 p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="rounded bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{rc.category}</span>
                  {rc.supportingTicketIds.length > 0 && (
                    <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{rc.supportingTicketIds.length} similar</span>
                  )}
                </div>
                {rc.description && <p className="text-xs text-muted line-clamp-2">{rc.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border bg-panel/50 px-md py-2.5">
        <div className="flex items-center gap-1.5 text-xs">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          <span className="font-bold text-text">{investigations.length}</span>
          <span className="text-dim">{t('investigations')}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
          <span className="font-bold text-text">{totalHypotheses}</span>
          <span className="text-dim">{t('hypotheses')}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <ListChecks className="h-3.5 w-3.5 text-blue-600" />
          <span className="font-bold text-text">{totalFindings}</span>
          <span className="text-dim">{t('findings')}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs">
          <Link2 className="h-3.5 w-3.5 text-purple-600" />
          <span className="font-bold text-text">{totalEvidences}</span>
          <span className="text-dim">{t('evidences')}</span>
        </div>
      </div>

      {/* New investigation */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (summary.trim()) create.mutate(); }}
        className="flex items-center gap-sm"
      >
        <div className="relative flex-1">
          <FlaskConical className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-dim" />
          <input
            className={FIELD_MD + ' flex-1 pl-9'}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t('newPh')}
          />
        </div>
        <Button type="submit" disabled={!summary.trim()} loading={create.isPending}>
          <Plus className="h-4 w-4" /> {t('start')}
        </Button>
      </form>

      {/* List */}
      {investigations.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-dim">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-panel-2">
            <FlaskConical className="h-8 w-8" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-text mb-1">{t('empty')}</p>
            <p className="text-xs">{t('emptyHint')}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {investigations.map((inv) => (
            <InvestigationCard
              key={inv.id}
              ticketId={ticketId}
              inv={inv}
              expanded={expandedId === inv.id}
              onToggle={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InvestigationCard({ ticketId, inv, expanded, onToggle }: { ticketId: number; inv: InvestigationResponse; expanded: boolean; onToggle: () => void }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const finished = !!inv.finishedAt;
  const [hyp, setHyp] = useState('');
  const [finding, setFinding] = useState('');
  const [evType, setEvType] = useState<EvidenceTypeValue>(EvidenceType.Observation);
  const [evNotes, setEvNotes] = useState('');
  const [evUrl, setEvUrl] = useState('');
  const [activeSection, setActiveSection] = useState<'hypotheses' | 'findings' | 'evidences'>('hypotheses');

  const invalidate = () => { qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); };

  const addHypothesis = useMutation({
    mutationFn: () => investigationsApi.addHypothesis(inv.id, { description: hyp.trim() }),
    onSuccess: () => { setHyp(''); invalidate(); toast.success(t('hypothesisAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const addFinding = useMutation({
    mutationFn: () => investigationsApi.addFinding(inv.id, { description: finding.trim() }),
    onSuccess: () => { setFinding(''); invalidate(); toast.success(t('findingAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const addEvidence = useMutation({
    mutationFn: () => investigationsApi.addEvidence(inv.id, {
      type: evType,
      notes: evNotes.trim() || null,
      url: evUrl.trim() || null,
    }),
    onSuccess: () => { setEvNotes(''); setEvUrl(''); invalidate(); toast.success(t('evidenceAdded')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const finishInv = useMutation({
    mutationFn: () => investigationsApi.finish(inv.id),
    onSuccess: () => { invalidate(); toast.success(t('finished')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const updateHypStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: HypothesisStatusValue }) => investigationsApi.updateHypothesisStatus(id, status),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const evidenceHints = useEvidenceHints();
  const evHint = evidenceHints[evType];
  const datalistId = `inv-${inv.id}-ev-suggestions`;

  const confirmedCount = inv.hypotheses.filter(h => h.status === 'Confirmed').length;
  const discardedCount = inv.hypotheses.filter(h => h.status === 'Discarded').length;
  const openCount = inv.hypotheses.length - confirmedCount - discardedCount;
  const resolvedPercent = inv.hypotheses.length > 0
    ? Math.round(((confirmedCount + discardedCount) / inv.hypotheses.length) * 100)
    : 0;

  const sections = [
    { key: 'hypotheses' as const, label: t('hypotheses'), icon: HelpCircle, count: inv.hypotheses.length, color: 'text-amber-600' },
    { key: 'findings' as const, label: t('findings'), icon: ListChecks, count: inv.findingItems.length, color: 'text-blue-600' },
    { key: 'evidences' as const, label: t('evidences'), icon: Link2, count: inv.evidences.length, color: 'text-purple-600' },
  ];

  return (
    <div className={cn('card-surface overflow-hidden transition-all', finished && 'opacity-70')}>
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-md py-3 text-left hover:bg-bg-subtle/50 transition-colors">
        <div className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', finished ? 'bg-emerald-50' : 'bg-primary/10')}>
          <FlaskConical className={cn('h-4 w-4', finished ? 'text-emerald-600' : 'text-primary')} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-text truncate">{inv.summary}</h4>
            <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase', finished ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700')}>
              {finished ? t('finished') : t('inProgress')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-dim mt-0.5">
            <span>{inv.hypotheses.length} {t('hypotheses')}</span>
            <span>·</span>
            <span>{inv.findingItems.length} {t('findings')}</span>
            <span>·</span>
            <span>{inv.evidences.length} {t('evidences')}</span>
          </div>
        </div>
        {inv.hypotheses.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <div className="w-20 h-1.5 rounded-full bg-panel-2 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', resolvedPercent === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${resolvedPercent}%` }} />
            </div>
            <span className="text-[10px] text-dim w-8">{resolvedPercent}%</span>
          </div>
        )}
        <ChevronRight className={cn('h-4 w-4 text-dim transition-transform shrink-0', expanded && 'rotate-90')} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="flex items-center justify-between gap-2 px-md py-2 bg-panel-2/30 border-b border-border">
            <div className="flex gap-0.5">
              {sections.map((s) => (
                <button key={s.key} type="button" onClick={() => setActiveSection(s.key)} className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors',
                  activeSection === s.key ? 'bg-panel text-text shadow-sm border border-border' : 'text-dim hover:text-muted hover:bg-bg-subtle'
                )}>
                  <s.icon className={cn('h-3.5 w-3.5', activeSection === s.key ? s.color : '')} />
                  {s.label}
                  {s.count > 0 && <span className="rounded-full bg-panel-2 px-1.5 text-[10px]">{s.count}</span>}
                </button>
              ))}
            </div>
            {!finished && (
              <Button size="sm" variant="secondary" onClick={() => finishInv.mutate()} loading={finishInv.isPending} className="h-7 text-xs">
                <Check className="h-3 w-3" /> {t('finish')}
              </Button>
            )}
          </div>

          <div className="p-md">
            {activeSection === 'hypotheses' && (
              <div className="flex flex-col gap-2">
                {inv.hypotheses.length > 0 && (
                  <div className="flex items-center gap-3 mb-1 text-[10px] text-dim">
                    {confirmedCount > 0 && <span className="text-emerald-600">✓ {confirmedCount} {t('hStatus.Confirmed')}</span>}
                    {openCount > 0 && <span className="text-amber-600">● {openCount} {t('hStatus.Open')}</span>}
                    {discardedCount > 0 && <span className="text-slate-400">✗ {discardedCount} {t('hStatus.Discarded')}</span>}
                  </div>
                )}
                {inv.hypotheses.length === 0 && <p className="text-xs text-dim italic py-4 text-center">{t('noHypotheses')}</p>}
                {inv.hypotheses.map((h) => (
                  <div key={h.id} className={cn(
                    'flex items-center gap-3 rounded-lg border p-2.5 text-xs transition-colors',
                    h.status === 'Confirmed' ? 'border-emerald-200 bg-emerald-50/50' :
                    h.status === 'Discarded' ? 'border-slate-200 bg-slate-50/50 opacity-60' :
                    'border-amber-200 bg-amber-50/50'
                  )}>
                    <div className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold',
                      h.status === 'Confirmed' ? 'bg-emerald-200 text-emerald-800' :
                      h.status === 'Discarded' ? 'bg-slate-200 text-slate-500' : 'bg-amber-200 text-amber-800'
                    )}>
                      {h.status === 'Confirmed' ? '✓' : h.status === 'Discarded' ? '✗' : '?'}
                    </div>
                    <p className={cn('flex-1', h.status === 'Discarded' && 'line-through')}>{h.description}</p>
                    <select
                      value={HypothesisStatus[h.status as keyof typeof HypothesisStatus] ?? HypothesisStatus.Open}
                      onChange={(e) => updateHypStatus.mutate({ id: h.id, status: Number(e.target.value) as HypothesisStatusValue })}
                      className="shrink-0 rounded-md border border-border bg-panel px-2 py-1 text-[10px] font-medium outline-none cursor-pointer"
                    >
                      {Object.entries(HypothesisStatus).map(([k, v]) => (
                        <option key={k} value={v}>{t(`hStatus.${k}` as 'hStatus.Open')}</option>
                      ))}
                    </select>
                  </div>
                ))}
                {!finished && (
                  <form onSubmit={(e) => { e.preventDefault(); if (hyp.trim()) addHypothesis.mutate(); }} className="mt-1 flex gap-1.5">
                    <input className={FIELD_SM + ' flex-1'} value={hyp} onChange={(e) => setHyp(e.target.value)} placeholder={t('addHypothesis')} />
                    <Button type="submit" size="sm" variant="secondary" disabled={!hyp.trim()} loading={addHypothesis.isPending} className="h-8 shrink-0 text-xs">
                      <Plus className="h-3 w-3" /> {t('add')}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {activeSection === 'findings' && (
              <div className="flex flex-col gap-2">
                {inv.findingItems.length === 0 && <p className="text-xs text-dim italic py-4 text-center">{t('noFindings')}</p>}
                {inv.findingItems.map((f) => (
                  <div key={f.id} className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/30 p-2.5 text-xs">
                    <div className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <p className="flex-1 text-text">{f.description}</p>
                  </div>
                ))}
                {!finished && (
                  <form onSubmit={(e) => { e.preventDefault(); if (finding.trim()) addFinding.mutate(); }} className="mt-1 flex gap-1.5">
                    <input className={FIELD_SM + ' flex-1'} value={finding} onChange={(e) => setFinding(e.target.value)} placeholder={t('addFinding')} />
                    <Button type="submit" size="sm" variant="secondary" disabled={!finding.trim()} loading={addFinding.isPending} className="h-8 shrink-0 text-xs">
                      <Plus className="h-3 w-3" /> {t('add')}
                    </Button>
                  </form>
                )}
              </div>
            )}

            {activeSection === 'evidences' && (
              <div className="flex flex-col gap-2">
                {inv.evidences.length === 0 && <p className="text-xs text-dim italic py-4 text-center">{t('noEvidences')}</p>}
                {inv.evidences.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2.5 rounded-lg border border-purple-100 bg-purple-50/30 p-2.5 text-xs">
                    <div className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-purple-800">{t(`eType.${ev.type}` as 'eType.Log')}</span>
                      {ev.notes && <p className="text-muted mt-0.5">{ev.notes}</p>}
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
                          <ExternalLink className="h-3 w-3" /> <span className="truncate max-w-[250px]">{ev.url}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {!finished && (
                  <div className="mt-1 flex flex-col gap-2">
                    <form onSubmit={(e) => { e.preventDefault(); addEvidence.mutate(); }} className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Select<EvidenceTypeValue>
                          value={evType}
                          onChange={(v) => { setEvType(v); setEvNotes(''); setEvUrl(''); }}
                          options={Object.entries(EvidenceType).map(([k, v]) => ({ value: v as EvidenceTypeValue, label: t(`eType.${k}` as 'eType.Log') }))}
                          className="text-xs w-36 shrink-0"
                        />
                        <input list={datalistId} className={FIELD_SM + ' flex-1'} value={evNotes} onChange={(e) => setEvNotes(e.target.value)} placeholder={evHint.ph} />
                        <datalist id={datalistId}>{evHint.suggestions.map((s) => <option key={s} value={s} />)}</datalist>
                      </div>
                      {evHint.needsUrl && <input type="url" className={FIELD_SM} value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder={t('url')} />}
                      <div className="flex items-center gap-2">
                        <Button type="submit" size="sm" variant="secondary" loading={addEvidence.isPending}>
                          <Plus className="h-3.5 w-3.5" /> {t('add')}
                        </Button>
                        <EvidenceFileUpload investigationId={inv.id} ticketId={inv.ticketId} evType={evType} onDone={invalidate} />
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   ROOT CAUSES TAB - Diagnóstico Final
   ================================================================ */
function RootCausesTab({ ticketId }: { ticketId: number }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<RootCauseCategoryValue>(RootCauseCategory.Bug);
  const [confidence, setConfidence] = useState('70');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const list = useQuery({ queryKey: ['rootcauses', ticketId], queryFn: () => rootCausesApi.byTicket(ticketId) });

  const create = useMutation({
    mutationFn: () => rootCausesApi.create(ticketId, { 
      title: title.trim(), 
      description: description.trim(), 
      category, 
      confidenceScore: (Number(confidence) || 0) / 100 
    }),
    onSuccess: () => { 
      setTitle(''); 
      setDescription(''); 
      setOpen(false); 
      qc.invalidateQueries({ queryKey: ['rootcauses', ticketId] }); 
      toast.success(t('newRootCause')); 
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const getCategoryConfig = (cat: string) => {
    switch(cat) {
      case 'Bug': return { icon: Bug, color: 'bg-red-50 text-red-700 border-red-200', barColor: 'bg-red-500' };
      case 'Configuration': return { icon: Wrench, color: 'bg-orange-50 text-orange-700 border-orange-200', barColor: 'bg-orange-500' };
      case 'Process': return { icon: Workflow, color: 'bg-blue-50 text-blue-700 border-blue-200', barColor: 'bg-blue-500' };
      case 'Training': return { icon: BookOpen, color: 'bg-purple-50 text-purple-700 border-purple-200', barColor: 'bg-purple-500' };
      case 'External': return { icon: ExternalLink, color: 'bg-slate-50 text-slate-700 border-slate-200', barColor: 'bg-slate-500' };
      default: return { icon: AlertTriangle, color: 'bg-gray-50 text-gray-700 border-gray-200', barColor: 'bg-gray-500' };
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.7) return 'bg-emerald-500';
    if (score >= 0.4) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const totalCauses = list.data?.length ?? 0;
  const avgConfidence = totalCauses > 0 
    ? Math.round((list.data!.reduce((acc, rc) => acc + rc.confidenceScore, 0) / totalCauses) * 100) 
    : 0;

  return (
    <div className="flex flex-col gap-lg">
      {/* Header com métricas */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">{t('rootCauses')}</h3>
          <p className="text-xs text-dim mt-0.5">{t('rootCausesSubtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          {totalCauses > 0 && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-dim">
              <span>{totalCauses} {totalCauses === 1 ? t('causeIdentified') : t('causesIdentified')}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Target className="h-3 w-3" />
                {t('avgConfidence')}: {avgConfidence}%
              </span>
            </div>
          )}
          <Can permission="rootcause.create">
            <Button size="sm" onClick={() => setOpen(!open)}>
              <Plus className="h-4 w-4" /> {t('newRootCause')}
            </Button>
          </Can>
        </div>
      </div>

      {/* Formulário de nova causa raiz */}
      {open && (
        <div className="card-surface border-2 border-primary/20 bg-primary/[0.02] p-lg">
          <div className="flex items-center gap-3 mb-lg">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text">{t('identifyRootCause')}</h4>
              <p className="text-xs text-dim">{t('identifyRootCauseHint')}</p>
            </div>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (title.trim()) create.mutate(); }} className="flex flex-col gap-md">
            <div className="grid gap-md md:grid-cols-2">
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                <span className="font-medium">{t('rcTitle')}</span>
                <input 
                  className={FIELD_MD} 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder={t('rcTitlePh')} 
                />
              </label>
              
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                <span className="font-medium">{t('category')}</span>
                <Select<RootCauseCategoryValue> 
                  value={category} 
                  onChange={setCategory} 
                  options={Object.entries(RootCauseCategory).map(([k, v]) => ({ 
                    value: v as RootCauseCategoryValue, 
                    label: t(`cat.${k}` as 'cat.Bug') 
                  }))} 
                />
              </label>
            </div>
            
            <label className="flex flex-col gap-1.5 text-xs text-muted">
              <span className="font-medium">{t('rcDescription')}</span>
              <textarea 
                className={FIELD_BASE + ' h-24 resize-none'} 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                placeholder={t('rcDescriptionPh')} 
              />
            </label>
            
            <div className="flex items-end gap-md">
              <label className="flex w-32 flex-col gap-1.5 text-xs text-muted">
                <span className="font-medium">{t('confidence')} (%)</span>
                <input 
                  type="number" 
                  min={0} 
                  max={100} 
                  className={FIELD_MD} 
                  value={confidence} 
                  onChange={(e) => setConfidence(e.target.value)} 
                />
              </label>
              
              <div className="flex gap-2">
                <Button type="submit" disabled={!title.trim()} loading={create.isPending}>
                  <Check className="h-4 w-4" /> {t('save')}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                  {t('cancel')}
                </Button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Lista de causas raiz */}
      {list.isLoading ? (
        <LoadingState />
      ) : totalCauses === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-dim">
          <div className="grid h-20 w-20 place-items-center rounded-full bg-panel-2">
            <Sigma className="h-10 w-10" />
          </div>
          <div className="text-center max-w-sm">
            <p className="text-sm font-medium text-text mb-1">{t('noRootCauses')}</p>
            <p className="text-xs">{t('noRootCausesHint')}</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-md lg:grid-cols-2">
          {list.data!.map((rc) => {
            const catConfig = getCategoryConfig(rc.category);
            const CatIcon = catConfig.icon;
            const confidencePercent = Math.round(rc.confidenceScore * 100);
            
            return (
              <div key={rc.id} className="card-surface overflow-hidden group hover:border-primary/30 transition-all">
                {/* Barra de confiança superior */}
                <div className="h-1 bg-panel-2">
                  <div 
                    className={cn('h-full transition-all', getConfidenceColor(rc.confidenceScore))}
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>

                <div className="p-lg">
                  <div className="flex items-start gap-3 mb-lg">
                    <div className={cn(
                      'grid h-12 w-12 shrink-0 place-items-center rounded-xl border-2',
                      catConfig.color
                    )}>
                      <CatIcon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-text mb-1">{rc.title}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'rounded-full border px-2.5 py-0.5 text-[10px] font-medium',
                          catConfig.color
                        )}>
                          {t(`cat.${rc.category}` as 'cat.Bug')}
                        </span>
                        <span className="text-[10px] text-dim">
                          {confidencePercent}% {t('confidence').toLowerCase()}
                        </span>
                        {rc.resolutionsCount > 0 && (
                          <span className="text-[10px] text-dim">
                            · {rc.resolutionsCount} {t('resolutions')}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Gauge circular */}
                    <div className="shrink-0 relative">
                      <svg className="h-14 w-14 -rotate-90">
                        <circle cx="28" cy="28" r="24" fill="none" stroke="currentColor" strokeWidth="3" className="text-panel-2" />
                        <circle 
                          cx="28" cy="28" r="24" fill="none" 
                          strokeWidth="3" 
                          strokeLinecap="round"
                          className={getConfidenceColor(rc.confidenceScore)}
                          strokeDasharray={`${2 * Math.PI * 24}`}
                          strokeDashoffset={`${2 * Math.PI * 24 * (1 - rc.confidenceScore)}`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
                        {confidencePercent}%
                      </span>
                    </div>
                  </div>

                  {expandedId !== rc.id && rc.description && (
                    <p className="text-xs text-dim mb-lg leading-relaxed line-clamp-2">{rc.description}</p>
                  )}

                  {expandedId === rc.id && (
                    <div className="mb-lg space-y-2">
                      {rc.description && <p className="text-xs text-dim leading-relaxed">{rc.description}</p>}
                      <div className="grid grid-cols-2 gap-2 text-xs text-dim">
                        <span>{t('category')}: <strong className="text-text">{t(`cat.${rc.category}` as 'cat.Bug')}</strong></span>
                        <span>{t('confidence')}: <strong className="text-text">{Math.round(rc.confidenceScore * 100)}%</strong></span>
                        {rc.resolutionsCount > 0 && <span>{t('resolutions')}: <strong className="text-text">{rc.resolutionsCount}</strong></span>}
                      </div>
                    </div>
                  )}

                  {/* Rodapé com ações */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => setExpandedId(expandedId === rc.id ? null : rc.id)}>
                      <Eye className="h-3.5 w-3.5" /> {expandedId === rc.id ? t('hideDetails') : t('viewDetails')}
                    </Button>
                    {rc.resolutionsCount > 0 && (
                      <Button size="sm" variant="ghost" className="text-xs">
                        <Lightbulb className="h-3.5 w-3.5" /> {t('seeResolutions')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   RESOLUTION TAB - Aplicar/visualizar resolução do ticket
   ================================================================ */
function ResolutionTab({ ticketId, ticketTitle }: { ticketId: number; ticketTitle: string }) {
  const t = useTranslations('resolution');
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [rootCauseTitle, setRootCauseTitle] = useState('');
  const [rootCauseSummary, setRootCauseSummary] = useState('');
  const [rootCauseCategory, setRootCauseCategory] = useState<RootCauseCategoryValue>(RootCauseCategory.Bug);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [outcome, setOutcome] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const rootCauses = useQuery({ queryKey: ['rootcauses', ticketId], queryFn: () => rootCausesApi.byTicket(ticketId) });
  const [selectedRootCauseId, setSelectedRootCauseId] = useState<number | null>(null);

  const resolve = useMutation({
    mutationFn: () =>
      ticketsApi.resolve(ticketId, {
        rootCauseTitle: selectedRootCauseId ? (rootCauses.data?.find(r => r.id === selectedRootCauseId)?.title ?? rootCauseTitle) : rootCauseTitle,
        rootCauseSummary: selectedRootCauseId ? (rootCauses.data?.find(r => r.id === selectedRootCauseId)?.description ?? rootCauseSummary) : rootCauseSummary,
        rootCauseCategory,
        resolutionSummary: resolutionSummary.trim(),
        outcome: outcome.trim(),
        actions: [],
        symptomTagIds: [],
        isRecurring,
      }),
    onSuccess: () => {
      toast.success(t('resolvedOk'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('resolveError'))),
  });

  const steps = [
    { label: t('stepRootCause'), icon: Target },
    { label: t('stepResolution'), icon: Zap },
    { label: t('stepConfirm'), icon: Check },
  ];

  const canNext = step === 0
    ? (selectedRootCauseId || rootCauseTitle.trim())
    : step === 1
    ? resolutionSummary.trim()
    : true;

  return (
    <div className="flex flex-col gap-lg max-w-3xl">
      {/* Wizard stepper */}
      <div className="flex items-center gap-1">
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          return (
            <div key={i} className="flex items-center gap-1 flex-1">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all flex-1',
                  i === step ? 'bg-primary text-white shadow-sm' :
                  i < step ? 'bg-success/10 text-success cursor-pointer hover:bg-success/20' :
                  'bg-panel-2 text-dim'
                )}
              >
                <StepIcon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < steps.length - 1 && <ArrowRight className="h-3 w-3 text-dim shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Step 0: Root Cause */}
      {step === 0 && (
        <div className="card-surface p-lg flex flex-col gap-md">
          <div className="flex items-center gap-3 mb-sm">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50">
              <Target className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('selectOrCreateCause')}</h4>
              <p className="text-xs text-dim">{t('selectOrCreateCauseHint')}</p>
            </div>
          </div>

          {(rootCauses.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-dim uppercase tracking-wide">{t('existingCauses')}</p>
              {rootCauses.data!.map((rc) => (
                <button
                  key={rc.id}
                  type="button"
                  onClick={() => { setSelectedRootCauseId(rc.id === selectedRootCauseId ? null : rc.id); setRootCauseTitle(''); }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                    selectedRootCauseId === rc.id
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                      : 'border-border hover:border-border-strong'
                  )}
                >
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">{Math.round(rc.confidenceScore * 100)}%</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{rc.title}</p>
                    <p className="text-xs text-dim truncate">{rc.category} · {rc.description}</p>
                  </div>
                  {selectedRootCauseId === rc.id && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              ))}
              <div className="flex items-center gap-2 py-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[10px] uppercase text-dim">{t('orCreateNew')}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          {!selectedRootCauseId && (
            <div className="flex flex-col gap-md">
              <div className="grid gap-md md:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  <span className="font-medium">{t('causeTitle')}</span>
                  <input className={FIELD_MD} value={rootCauseTitle} onChange={(e) => setRootCauseTitle(e.target.value)} placeholder={t('causeTitlePh')} />
                </label>
                <label className="flex flex-col gap-1.5 text-xs text-muted">
                  <span className="font-medium">{t('category')}</span>
                  <Select<RootCauseCategoryValue> value={rootCauseCategory} onChange={setRootCauseCategory} options={Object.entries(RootCauseCategory).map(([k, v]) => ({ value: v as RootCauseCategoryValue, label: k }))} />
                </label>
              </div>
              <label className="flex flex-col gap-1.5 text-xs text-muted">
                <span className="font-medium">{t('causeSummary')}</span>
                <textarea className={FIELD_BASE + ' h-20 resize-none'} value={rootCauseSummary} onChange={(e) => setRootCauseSummary(e.target.value)} placeholder={t('causeSummaryPh')} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Resolution */}
      {step === 1 && (
        <div className="card-surface p-lg flex flex-col gap-md">
          <div className="flex items-center gap-3 mb-sm">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-50">
              <Zap className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('describeResolution')}</h4>
              <p className="text-xs text-dim">{t('describeResolutionHint')}</p>
            </div>
          </div>

          <label className="flex flex-col gap-1.5 text-xs text-muted">
            <span className="font-medium">{t('resolutionSummary')}</span>
            <textarea className={FIELD_BASE + ' h-28 resize-none'} value={resolutionSummary} onChange={(e) => setResolutionSummary(e.target.value)} placeholder={t('resolutionSummaryPh')} />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-muted">
            <span className="font-medium">{t('outcome')}</span>
            <input className={FIELD_MD} value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder={t('outcomePh')} />
          </label>

          <Checkbox
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.currentTarget.checked)}
            label={<span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" />{t('isRecurring')}</span>}
            size="sm"
          />
        </div>
      )}

      {/* Step 2: Confirm */}
      {step === 2 && (
        <div className="card-surface p-lg flex flex-col gap-md">
          <div className="flex items-center gap-3 mb-sm">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-blue-50">
              <Check className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">{t('confirmTitle')}</h4>
              <p className="text-xs text-dim">{t('confirmHint')}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm">
            <div className="flex items-start gap-2">
              <Target className="h-4 w-4 text-dim mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase text-dim">{t('rootCause')}</p>
                <p className="font-medium">{selectedRootCauseId ? rootCauses.data?.find(r => r.id === selectedRootCauseId)?.title : rootCauseTitle}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-dim mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] font-medium uppercase text-dim">{t('resolution')}</p>
                <p>{resolutionSummary}</p>
              </div>
            </div>
            {outcome && (
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-dim mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-medium uppercase text-dim">{t('outcome')}</p>
                  <p>{outcome}</p>
                </div>
              </div>
            )}
            {isRecurring && (
              <div className="rounded bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning flex items-center gap-2">
                <RotateCcw className="h-3.5 w-3.5" /> {t('markedRecurring')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          {t('back')}
        </Button>
        {step < 2 ? (
          <Button disabled={!canNext} onClick={() => setStep(step + 1)}>
            {t('next')} <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={() => resolve.mutate()} loading={resolve.isPending} className="bg-success hover:bg-success/90">
            <Zap className="h-4 w-4" /> {t('resolveTicket')}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   TASKS TAB (Work Items)
   ================================================================ */
const TASK_STATUSES = ['Backlog', 'InProgress', 'Done', 'Cancelled'] as const;

function taskStatusColor(s: string) {
  switch (s) {
    case 'Backlog': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'InProgress': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Done': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'Cancelled': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}

function taskStatusIcon(s: string) {
  switch (s) {
    case 'Done': return <Check className="h-3.5 w-3.5 text-emerald-600" />;
    case 'InProgress': return <Loader2 className="h-3.5 w-3.5 text-amber-600 animate-spin" />;
    case 'Cancelled': return <X className="h-3.5 w-3.5 text-slate-400" />;
    default: return <div className="h-3.5 w-3.5 rounded-full border-2 border-blue-400" />;
  }
}

/** Strip HTML tags to check if rich-editor has actual visible text */
function hasEditorContent(html: string) {
  return html.replace(/<[^>]*>/g, '').trim().length > 0;
}

function WorkItemsTab({ ticketId }: { ticketId: number }) {
  const t = useTranslations('workItems');
  const locale = useLocale() as Locale;
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingNew, setPendingNew] = useState<EngineeringWorkItemResponse | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editAssignee, setEditAssignee] = useState<number | null>(null);
  const [logTimeInput, setLogTimeInput] = useState('0:00');
  const [logDesc, setLogDesc] = useState('');
  const [logType, setLogType] = useState(3);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const worklogTypes = useWorklogTypes();

  const list = useQuery({
    queryKey: ['workitems', ticketId],
    queryFn: () => workItemsApi.byTicket(ticketId),
    retry: false,
  });
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 200) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['workitems', ticketId] });
  const userOptions: ComboOption[] = (users.data?.items ?? []).map(u => ({ id: u.id, label: u.name, hint: u.email }));
  const userMap = new Map((users.data?.items ?? []).map(u => [u.id, u.name]));

  const create = useMutation({
    mutationFn: () => workItemsApi.create(ticketId, { title: newTitle.trim(), technicalDescription: newDesc || undefined }),
    onSuccess: (created) => {
      invalidate();
      setNewTitle('');
      setNewDesc('');
      setCreating(false);
      setPendingNew(created);
      setSelectedId(created.id);
      setEditDesc(created.technicalDescription ?? '');
      setEditAssignee(created.assignedToId ?? null);
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('createError'))),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => workItemsApi.updateStatus(ticketId, id, status),
    onSuccess: invalidate,
    onError: (err) => toast.error(apiErrorMessage(err, t('updateError'))),
  });

  const updateItem = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Parameters<typeof workItemsApi.update>[2] }) =>
      workItemsApi.update(ticketId, id, body),
    onSuccess: () => { invalidate(); toast.success(t('saved')); },
    onError: (err) => toast.error(apiErrorMessage(err, t('saveError'))),
  });

  const allItems = list.data ?? [];
  const doneCount = allItems.filter(i => i.status === 'Done').length;
  const totalCount = allItems.length;
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  // Use pendingNew as fallback while the refetch hasn't returned the newly created item yet
  const selected = allItems.find(i => i.id === selectedId) ?? (pendingNew?.id === selectedId ? pendingNew : null);

  const parseLogTime = (val: string) => {
    const parts = val.split(':');
    const h = parseInt(parts[0]) || 0;
    const m = parseInt(parts[1]) || 0;
    return h * 60 + m;
  };

  const logDuration = parseLogTime(logTimeInput);

  const logWorkItem = useMutation({
    mutationFn: async () => {
      const description = logDesc.trim() || (selected ? selected.title : '');
      const created = await worklogsApi.create(ticketId, { type: logType, description, startedAt: new Date().toISOString() });
      await worklogsApi.updateDuration(created.id, logDuration);
      return created;
    },
    onSuccess: () => {
      toast.success(t('timeLogged'));
      setLogTimeInput('0:00');
      setLogDesc('');
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('logError'))),
  });

  const selectTask = (task: typeof allItems[number]) => {
    setSelectedId(task.id);
    setEditDesc(task.technicalDescription ?? '');
    setEditAssignee(task.assignedToId ?? null);
    setLogTimeInput('0:00');
    setLogDesc('');
  };

  const handleSave = () => {
    if (!selected) return;
    updateItem.mutate({
      id: selected.id,
      body: {
        technicalDescription: editDesc,
        assignedToId: editAssignee,
      },
    });
  };

  const handleFileUpload = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setUploadingFile(true);
    try {
      for (const file of arr) {
        await ticketsApi.uploadAttachment(ticketId, file);
      }
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
      toast.success(t('attachUploaded'));
    } catch (err) {
      toast.error(t('attachError'));
    } finally {
      setUploadingFile(false);
    }
  };

  const canCreate = newTitle.trim().length > 0 && hasEditorContent(newDesc);
  const rightMode: 'empty' | 'create' | 'detail' = selected ? 'detail' : creating ? 'create' : 'empty';

  return (
    <div className="flex h-full" style={{ minHeight: 520 }}>

      {/* ══ LEFT: lista ══ */}
      <div className={cn('flex flex-col border-r border-border', rightMode !== 'empty' ? 'w-[280px] shrink-0' : 'flex-1')}>

        {/* Header */}
        <div className="flex items-center justify-between px-lg py-md border-b border-border shrink-0">
          <div className="flex items-center gap-sm">
            <span className="text-sm font-semibold text-text">Tasks</span>
            {totalCount > 0 && (
              <>
                <div className="w-16 h-1 overflow-hidden rounded-full bg-panel-2">
                  <div className={cn('h-full rounded-full transition-all', progress === 100 ? 'bg-emerald-500' : 'bg-primary')} style={{ width: `${progress}%` }} />
                </div>
                <span className="text-xs text-dim tabular-nums">{doneCount}/{totalCount}</span>
              </>
            )}
          </div>
          <Can permission="ticket.update">
            <Button
              size="sm"
              variant={creating && !selected ? 'primary' : 'secondary'}
              onClick={() => { setCreating(true); setSelectedId(null); }}
            >
              <Plus className="h-3.5 w-3.5" />Nova task
            </Button>
          </Can>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-dim" /></div>
          ) : allItems.length === 0 ? (
            <div className="flex flex-col items-center gap-sm py-10 px-lg text-center">
              <ListChecks className="h-8 w-8 text-dim opacity-30" />
              <p className="text-sm font-medium text-text">{t('empty')}</p>
              <p className="text-xs text-dim">{t('emptyHint')}</p>
            </div>
          ) : allItems.map((task) => {
            const assigneeName = task.assignedToId ? userMap.get(task.assignedToId) : null;
            const initials = assigneeName ? assigneeName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() : null;
            const isSel = selectedId === task.id;
            return (
              <div
                key={task.id}
                onClick={() => { selectTask(task); setCreating(false); }}
                className={cn(
                  'group flex items-center gap-sm px-lg py-md cursor-pointer border-b border-border/40 transition-colors',
                  isSel ? 'bg-primary/8 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent hover:bg-panel-2/60',
                )}
              >
                <button type="button" onClick={(e) => { e.stopPropagation(); updateStatus.mutate({ id: task.id, status: task.status === 'Done' ? 'Backlog' : 'Done' }); }} className="shrink-0">
                  {taskStatusIcon(task.status)}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm truncate', task.status === 'Done' && 'line-through text-dim')}>{task.title}</p>
                  {assigneeName && <p className="text-xs text-dim truncate mt-px">{assigneeName}</p>}
                </div>
                {initials && (
                  <span className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ══ RIGHT: create form ou detalhe ══ */}
      {rightMode === 'create' && (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-lg py-md border-b border-border shrink-0">
            <span className="text-sm font-semibold text-text">Nova task</span>
            <button type="button" onClick={() => setCreating(false)} className="grid h-7 w-7 place-items-center rounded text-dim hover:text-text hover:bg-panel-2 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-md overflow-auto p-lg">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('titleLabel')} <span className="text-danger font-normal">*</span>
              <input
                className={FIELD_SM + ' w-full'}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t('titlePh')}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t('descriptionLabel')} <span className="text-danger font-normal">*</span>
              <MarkdownEditor value={newDesc} onChange={setNewDesc} placeholder={t('descriptionPh')} minHeight="160px" />
            </label>
          </div>
          <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
            <Button variant="secondary" onClick={() => { setCreating(false); setNewTitle(''); setNewDesc(''); }}>{t('close')}</Button>
            <Button disabled={!canCreate} loading={create.isPending} onClick={() => create.mutate()}>
              <Plus className="h-4 w-4" />{t('create')}
            </Button>
          </div>
        </div>
      )}

      {rightMode === 'detail' && selected && (
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex items-center gap-sm px-lg py-md border-b border-border shrink-0">
            <div className="flex items-center gap-sm flex-1 min-w-0">
              {taskStatusIcon(selected.status)}
              <h3 className="text-sm font-semibold text-text truncate">{selected.title}</h3>
            </div>
            <button type="button" onClick={() => setSelectedId(null)} className="grid h-7 w-7 shrink-0 place-items-center rounded text-dim hover:text-text hover:bg-panel-2 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-md overflow-auto p-lg">
            <div className="flex flex-col gap-1.5 text-sm font-medium">
              Status
              <div className="flex flex-wrap gap-sm">
                {TASK_STATUSES.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => updateStatus.mutate({ id: selected.id, status: s })}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                      selected.status === s ? taskStatusColor(s) : 'border-border text-dim hover:bg-panel-2 hover:text-text',
                    )}
                  >
                    {taskStatusIcon(s)}
                    {t(`status.${s}` as 'status.Open')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {t('assignee')}
              <AsyncCombobox options={userOptions} value={editAssignee} onChange={setEditAssignee} placeholder={t('unassigned')} allowClear />
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {t('descriptionLabel')}
              <MarkdownEditor value={editDesc} onChange={setEditDesc} placeholder={t('descriptionPh')} minHeight="150px" />
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {t('logTime')}
              <div className="flex flex-col gap-sm">
                <Select value={logType} onChange={setLogType} options={worklogTypes} />
                <input className={FIELD_SM + ' w-full'} value={logDesc} onChange={(e) => setLogDesc(e.target.value)} placeholder={t('logDescPh')} />
                <div className="flex items-center gap-sm">
                  <button type="button" onClick={() => { const m = Math.max(0, logDuration - 15); setLogTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-panel hover:bg-panel-2 text-dim transition-colors">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    className={FIELD_SM + ' flex-1 text-center font-semibold tabular-nums'}
                    value={logTimeInput}
                    onChange={(e) => setLogTimeInput(e.target.value.replace(/[^0-9:]/g, ''))}
                    onBlur={() => { const p = logTimeInput.split(':'); if (p.length !== 2 || isNaN(+p[0]) || isNaN(+p[1])) setLogTimeInput('0:00'); }}
                    placeholder="0:00"
                  />
                  <button type="button" onClick={() => { const m = logDuration + 15; setLogTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-panel hover:bg-panel-2 text-dim transition-colors">
                    <Plus className="h-4 w-4" />
                  </button>
                  <Button disabled={logDuration === 0} loading={logWorkItem.isPending} onClick={() => logWorkItem.mutate()} variant="secondary">
                    <Clock className="h-4 w-4" />{t('log')}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 text-sm font-medium">
              {t('attachments')}
              <label
                className={cn('flex flex-col items-center justify-center gap-sm rounded-lg border-2 border-dashed py-6 cursor-pointer transition-colors', uploadingFile ? 'opacity-50 pointer-events-none' : 'hover:border-primary/50 hover:bg-primary/5')}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) handleFileUpload(e.dataTransfer.files); }}
              >
                {uploadingFile ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <UploadCloud className="h-5 w-5 text-dim" />}
                <span className="text-sm text-dim">{uploadingFile ? t('uploading') : t('dropFiles')}</span>
                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) { handleFileUpload(e.target.files); e.target.value = ''; } }} />
              </label>
            </div>
          </div>

          <div className="flex shrink-0 justify-end gap-sm border-t border-border bg-panel p-md">
            <Button variant="secondary" onClick={() => setSelectedId(null)}>{t('close')}</Button>
            <Button onClick={handleSave} loading={updateItem.isPending}>{t('save')}</Button>
          </div>
        </div>
      )}

      {rightMode === 'empty' && (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center gap-sm text-dim">
          <ListChecks className="h-10 w-10 opacity-20" />
          <p className="text-sm">{t('taskDetail')}</p>
        </div>
      )}
    </div>
  );
}

type CommentFilter = 'all' | 'public' | 'internal';

function Conversation({ ticketId, comments, userName, locale, timeZone, onImagePaste }: { ticketId: number; comments: { id: number; userId: number; message: string; isInternal: boolean; createdAt: string | null }[]; userName: (id: number | null) => string; locale: Locale; timeZone: string; onImagePaste?: (file: File) => Promise<string> }) {
  const t = useTranslations('comments');
  const qc = useQueryClient();
  const meId = useAuthStore((s) => s.user?.id);
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<CommentFilter>('all');

  const add = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, text.trim(), internal),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('addError'))),
  });

  const filtered = comments.filter((c) =>
    filter === 'all' ? true : filter === 'internal' ? c.isInternal : !c.isInternal,
  );
  const counts = {
    all: comments.length,
    public: comments.filter((c) => !c.isInternal).length,
    internal: comments.filter((c) => c.isInternal).length,
  };

  const ini = (name: string) => name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone });
  const bottomRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">

      {/* Filter bar */}
      <div className="flex items-center gap-1.5 pb-3 shrink-0">
        {(['all', 'public', 'internal'] as CommentFilter[]).map((f) => (
          <button
            key={f} type="button" onClick={() => setFilter(f)}
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-dim hover:border-border-strong hover:text-text',
            )}
          >
            {t(`filter.${f}`)}
            <span className={cn('rounded-full px-1.5 py-px text-[10px] font-semibold tabular-nums', filter === f ? 'bg-primary text-white' : 'bg-panel-2 text-dim')}>
              {counts[f]}
            </span>
          </button>
        ))}
      </div>

      {/* Messages feed */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pb-3 min-h-0">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-dim">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium text-text">{t('empty')}</p>
            <p className="text-xs">{t('emptyHint')}</p>
          </div>
        ) : filtered.map((c) => {
          const isMe = c.userId === meId;
          const name = userName(c.userId);
          const avatar = ini(name);
          const time = c.createdAt ? timeFmt.format(new Date(c.createdAt)) : '';

          if (c.isInternal) return (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-warning/20 text-[11px] font-bold text-warning ring-2 ring-warning/10">
                {avatar || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-text">{name}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                    <Lock className="h-2.5 w-2.5" />{t('internal')}
                  </span>
                  {time && <span className="text-[10px] text-dim ml-auto">{time}</span>}
                </div>
                <div className="rounded-xl rounded-tl-none border border-warning/30 bg-warning/5 px-4 py-3">
                  <MarkdownContent content={c.message} />
                </div>
              </div>
            </div>
          );

          if (isMe) return (
            <div key={c.id} className="flex flex-row-reverse gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-fg">
                {avatar || '?'}
              </div>
              <div className="flex-1 min-w-0 flex flex-col items-end">
                <div className="flex items-center gap-2 mb-1.5">
                  {time && <span className="text-[10px] text-dim">{time}</span>}
                  <span className="text-xs font-semibold text-text">{name}</span>
                </div>
                <div className="max-w-[80%] rounded-xl rounded-tr-none border border-primary/20 bg-primary/10 px-4 py-3">
                  <MarkdownContent content={c.message} />
                </div>
              </div>
            </div>
          );

          return (
            <div key={c.id} className="flex gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-border bg-panel-2 text-[11px] font-bold text-text">
                {avatar || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-text">{name}</span>
                  {time && <span className="text-[10px] text-dim">{time}</span>}
                </div>
                <div className="max-w-[80%] rounded-xl rounded-tl-none border border-border bg-panel px-4 py-3">
                  <MarkdownContent content={c.message} />
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <Can permission="ticket.comment.add">
        <div className={cn('mt-2 rounded-xl border overflow-hidden transition-colors shrink-0', internal ? 'border-warning/40 bg-warning/5' : 'border-border bg-panel')}>
          <MarkdownEditor
            value={text}
            onChange={setText}
            placeholder={internal ? t('placeholderInternal') : t('placeholderPublic')}
            minHeight="80px"
            onImagePaste={onImagePaste}
          />
          <div className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-2">
            <Checkbox
              checked={internal}
              onChange={(e) => setInternal(e.currentTarget.checked)}
              label={
                <span className="flex items-center gap-1.5 text-xs">
                  <Lock className="h-3 w-3" />
                  {t('internalToggle')}
                </span>
              }
              size="sm"
            />
            <Button
              size="sm"
              disabled={!text.trim()}
              loading={add.isPending}
              onClick={() => add.mutate()}
            >
              <Send className="h-3.5 w-3.5" />{t('submit')}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}