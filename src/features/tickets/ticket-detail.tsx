'use client';

import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  MessageSquare, Clock, Info, Send, Lock, Timer, Sparkles, User, Users,
  Lightbulb, GitBranch, ChevronDown, UserPlus, Plus, Check, History, Paperclip, X,
  Edit3, Calendar, ArrowRight, Target, TrendingUp, BarChart3, Zap, ExternalLink,
  ChevronRight, Eye, Download, FileText, UploadCloud, Trash2, Minus,
  Link2, HelpCircle, Search, ShieldAlert, AlertTriangle, Bug, Wrench, BookOpen,
  FlaskConical, ListChecks, GanttChart, ArrowUpRight, ThumbsUp, ThumbsDown,
  Filter, Layers, Brain, Workflow, PieChart, Sigma
} from 'lucide-react';
import { ticketsApi, usersApi, teamsApi, intelligenceApi, worklogsApi, investigationsApi, rootCausesApi } from '@/shared/api/endpoints';
import {
  TicketStatus, STATUS_TRANSITIONS, apiErrorMessage, EvidenceType, HypothesisStatus, RootCauseCategory,
  type TicketStatusValue, type TicketStatusName, type TicketAttachmentResponse,
  type InvestigationResponse, type HypothesisStatusValue, type EvidenceTypeValue, type RootCauseCategoryValue,
} from '@/shared/api/types';
import type { Locale } from '@/shared/i18n/config';
import { useBrandingStore } from '@/features/tenant/branding-store';
import { formatDateTime } from '@/shared/lib/datetime';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { AsyncCombobox, type ComboOption } from '@/shared/ui/async-combobox';
import { Select } from '@/shared/ui/select';
import { PriorityBadge, StatusBadge } from './badges';
import { Can } from '@/features/auth/can';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { cn } from '@/shared/lib/utils';
import { SlaPanel } from './sla-panel';
import { TicketTimeline } from './timeline';
import { tokenStore } from '@/shared/api/token-store';
import { Portal } from '@/shared/ui/portal';

type SubTab = 'overview' | 'timeline' | 'conversation' | 'worklogs' | 'investigation' | 'rootCauses' | 'attachments' | 'intelligence';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const FIELD_BASE =
  'w-full rounded-md border border-border bg-bg-subtle px-2.5 text-sm text-text outline-none ' +
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
  const timeZone = useBrandingStore((s) => s.branding?.timeZone) ?? 'UTC';
  const qc = useQueryClient();
  const [sub, setSub] = useState<SubTab>('overview');

  const { data: ticket, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'detail', id],
    queryFn: () => ticketsApi.get(id),
  });
  const { data: sla } = useQuery({ queryKey: ['tickets', 'sla', id], queryFn: () => ticketsApi.getSla(id), enabled: !!ticket });
  const users = useQuery({ queryKey: ['users', 'options'], queryFn: () => usersApi.list(1, 100) });
  const teams = useQuery({ queryKey: ['teams'], queryFn: () => teamsApi.list() });

  const userOptions: ComboOption[] = (users.data?.items ?? []).map((u) => ({ id: u.id, label: u.name, hint: u.email }));
  const userName = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.name ?? `Usuário #${uid}` : '—');
  const teamName = (tid: number | null) => (tid ? teams.data?.find((t) => t.id === tid)?.name ?? `Equipe #${tid}` : '—');
  const userEmail = (uid: number | null) => (uid ? users.data?.items.find((u) => u.id === uid)?.email ?? null : null);

  const changeStatus = useMutation({
    mutationFn: (status: TicketStatusValue) => ticketsApi.changeStatus(id, status),
    onSuccess: () => {
      toast.success(tTicket('statusUpdated'));
      qc.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, tTicket('statusError'))),
  });

  if (isLoading) return <LoadingState label={tTicket('loading')} />;
  if (isError || !ticket)
    return <ErrorState title={tTicket('loadError')} onRetry={() => refetch()} retryLabel={tTicket('retry')} />;

  const tabs: { key: SubTab; label: string; icon: typeof Info; count?: number }[] = [
    { key: 'overview', label: tTicket('tabOverview'), icon: Info },
    { key: 'timeline', label: tTicket('tabTimeline'), icon: History },
    { key: 'conversation', label: tTicket('tabConversation'), icon: MessageSquare, count: ticket.comments.length },
    { key: 'worklogs', label: tTicket('tabWorklogs'), icon: Clock, count: ticket.worklogs.length },
    { key: 'investigation', label: tTicket('tabInvestigation'), icon: FlaskConical, count: ticket.investigations.length },
    { key: 'rootCauses', label: tTicket('tabRootCauses'), icon: Sigma },
    { key: 'attachments', label: tTicket('tabAttachments'), icon: Paperclip },
    { key: 'intelligence', label: tTicket('tabIntelligence'), icon: Brain },
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
            <h1 className="mt-1 truncate text-2xl font-bold leading-tight">{ticket.title}</h1>
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
              <StatusPicker value={ticket.status} disabled={changeStatus.isPending} onChange={(v) => changeStatus.mutate(v)} />
            </Can>
          </div>
        </div>

        <div className="mt-md flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-dim">·</span>
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

      <div className="min-h-0 flex-1 overflow-auto p-lg">
        {sub === 'overview' && (
          <div className="grid items-start gap-lg lg:grid-cols-3">
            <div className="flex flex-col gap-lg lg:col-span-2">
              <div>
                <p className="mb-sm h-5 text-xs font-semibold uppercase tracking-wide text-dim">{tTicket('description')}</p>
                <div className="card-surface min-h-[140px] whitespace-pre-wrap p-lg text-sm leading-relaxed text-text">
                  {ticket.description || '—'}
                </div>
              </div>
              <RecommendationsPanel ticketId={id} onOpenIntelligence={() => setSub('intelligence')} />
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
                <div className="card-surface flex flex-col gap-3 p-lg text-sm">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <TrackMini label="Estimado" value={fmtMin(ticket.estimateMinutes ?? 0)} />
                    <TrackMini label="Realizado" value={fmtMin(ticket.completedMinutes)} accent="primary" />
                    <TrackMini
                      label="Restante"
                      value={fmtMin(
                        ticket.remainingMinutes != null
                          ? Math.max(0, ticket.remainingMinutes)
                          : Math.max(0, (ticket.estimateMinutes ?? 0) - ticket.completedMinutes),
                      )}
                      accent={ticket.completedMinutes > (ticket.estimateMinutes ?? 0) ? 'danger' : undefined}
                    />
                  </div>
                  <EstimateInput ticketId={id} estimateMinutes={ticket.estimateMinutes} remainingMinutes={ticket.remainingMinutes} />
                </div>
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

        {sub === 'conversation' && <Conversation ticketId={id} comments={ticket.comments} userName={userName} locale={locale} timeZone={timeZone} />}

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

        {sub === 'rootCauses' && <RootCausesTab ticketId={id} />}

        {sub === 'attachments' && <AttachmentsTab ticketId={id} userName={userName} />}

        {sub === 'intelligence' && <IntelligencePanel ticketId={id} />}
      </div>
    </div>
  );
}

/* ---- Estimate Input ---- */
function EstimateInput({ ticketId, estimateMinutes, remainingMinutes }: { ticketId: number; estimateMinutes: number | null; remainingMinutes: number | null }) {
  const t = useTranslations('worklog');
  const qc = useQueryClient();
  const [estimateInput, setEstimateInput] = useState<string>(estimateMinutes ? String(estimateMinutes / 60) : '');
  const [remainingInput, setRemainingInput] = useState<string>(remainingMinutes != null ? String(remainingMinutes / 60) : '');

  const saveTracking = useMutation({
    mutationFn: () =>
      ticketsApi.updateTracking(ticketId, {
        estimateMinutes: estimateInput.trim() === '' ? null : Math.round(Number(estimateInput) * 60),
        remainingMinutes: remainingInput.trim() === '' ? null : Math.round(Number(remainingInput) * 60),
      }),
    onSuccess: () => {
      toast.success(t('trackingUpdated'));
      qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, t('trackingError'))),
  });

  return (
    <div className="flex items-end gap-2">
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-dim">{t('estimate')} (h)</span>
        <Input type="number" min={0} step="0.5" value={estimateInput} onChange={(e) => setEstimateInput(e.target.value)} placeholder="0" className="h-8 text-xs" />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-[10px] uppercase tracking-wide text-dim">{t('remaining')} (h)</span>
        <Input type="number" min={0} step="0.5" value={remainingInput} onChange={(e) => setRemainingInput(e.target.value)} placeholder="auto" className="h-8 text-xs" />
      </label>
      <Button type="button" size="sm" variant="secondary" onClick={() => saveTracking.mutate()} loading={saveTracking.isPending} className="h-8">
        {t('save')}
      </Button>
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

/* ---- Recommendations Panel ---- */
function RecommendationsPanel({ ticketId, onOpenIntelligence }: { ticketId: number; onOpenIntelligence: () => void }) {
  const qc = useQueryClient();
  const [handled, setHandled] = useState<Record<number, 'accepted' | 'ignored'>>({});
  const report = useQuery({ queryKey: ['tickets', 'intelligence', ticketId], queryFn: () => intelligenceApi.ticketReport(ticketId), retry: false });
  const feedback = useMutation({
    mutationFn: (v: { resolutionId: number; accepted: boolean }) => ticketsApi.recommendationFeedback(ticketId, { resolutionId: v.resolutionId, accepted: v.accepted, helpful: v.accepted }),
    onSuccess: (_d, v) => { setHandled((h) => ({ ...h, [v.resolutionId]: v.accepted ? 'accepted' : 'ignored' })); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); toast.success(v.accepted ? 'Recomendação aceita' : 'Recomendação ignorada'); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Não foi possível registrar o feedback')),
  });

  const suggestions = (report.data?.resolutionSuggestions ?? []).slice(0, 3);
  if (report.isLoading || suggestions.length === 0) return null;

  return (
    <div>
      <div className="mb-sm flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-dim"><Sparkles className="h-3.5 w-3.5 text-primary" /> Recomendações inteligentes</p>
        <button type="button" onClick={onOpenIntelligence} className="text-xs text-primary hover:underline">Ver análise completa</button>
      </div>
      <div className="flex flex-col gap-sm">
        {suggestions.map((r) => {
          const state = handled[r.resolutionId];
          return (
            <div key={r.resolutionId} className={cn('card-surface flex items-center gap-sm p-md transition-opacity', state === 'ignored' && 'opacity-50')}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Lightbulb className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.summary}</p>
                <p className="text-xs text-dim">{Math.round(r.similarityScore * 100)}% similar · {Math.round(r.successRate * 100)}% sucesso · {r.reusedCount}× reuso</p>
              </div>
              {state ? (
                <span className={cn('shrink-0 rounded px-2 py-0.5 text-xs font-semibold', state === 'accepted' ? 'bg-success/15 text-success' : 'bg-panel-2 text-dim')}>{state === 'accepted' ? 'Aceita' : 'Ignorada'}</span>
              ) : (
                <div className="flex shrink-0 gap-1">
                  <button type="button" onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: true })} disabled={feedback.isPending} className="grid h-7 w-7 place-items-center rounded-md text-success hover:bg-success/10" aria-label="Aceitar"><Check className="h-4 w-4" /></button>
                  <button type="button" onClick={() => feedback.mutate({ resolutionId: r.resolutionId, accepted: false })} disabled={feedback.isPending} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-panel-2" aria-label="Ignorar"><X className="h-4 w-4" /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  const types = useWorklogTypes();
  const qc = useQueryClient();
  const [type, setType] = useState(3);
  const [description, setDescription] = useState('');
  const [timeInput, setTimeInput] = useState('0:00');
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

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
    onSuccess: () => { toast.success('Registro removido'); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao remover')),
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
        <div className="card-surface p-lg">
          <h3 className="mb-md text-sm font-semibold">{t('timeTracking')}</h3>
          <div className="flex items-center gap-2 mb-md text-xs">
            <div className="text-center flex-1 bg-panel-2/50 rounded p-2">
              <p className="text-[10px] uppercase text-dim">{t('estimate')}</p>
              <p className="font-bold text-text text-sm">{fmtMin(estimateMin)}</p>
            </div>
            <ArrowRight className="h-3 w-3 text-dim shrink-0" />
            <div className="text-center flex-1 bg-panel-2/50 rounded p-2">
              <p className="text-[10px] uppercase text-dim">{t('completed')}</p>
              <p className="font-bold text-primary text-sm">{fmtMin(totalMin)}</p>
            </div>
            <ArrowRight className="h-3 w-3 text-dim shrink-0" />
            <div className="text-center flex-1 bg-panel-2/50 rounded p-2">
              <p className="text-[10px] uppercase text-dim">{t('remaining')}</p>
              <p className={cn('font-bold text-sm', totalMin > estimateMin ? 'text-danger' : 'text-text')}>{fmtMin(remainingMin)}</p>
            </div>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-2 mb-2">
            <div className={cn('h-full rounded-full transition-all', totalMin > estimateMin ? 'bg-danger' : 'bg-primary')} style={{ width: `${estimateMin > 0 ? Math.min(100, progress) : 0}%` }} />
          </div>
          <p className="text-[10px] text-dim text-right mb-lg">{estimateMin > 0 ? `${Math.round(progress)}%` : '—'}</p>

          <Can permission="worklog.create">
            <form onSubmit={(e) => { e.preventDefault(); if (canLog) log.mutate(); }} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('type')}
                <Select value={type} onChange={setType} options={types} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                {t('what')}
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('descriptionPh')} />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted">
                Tempo (h:min)
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => { const d = parseTimeInput(timeInput); const m = Math.max(0, d - 15); setTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-8 w-8 place-items-center rounded border border-border hover:bg-panel-2 text-dim"><Minus className="h-3 w-3" /></button>
                  <Input value={timeInput} onChange={(e) => handleTimeChange(e.target.value)} onBlur={handleTimeBlur} placeholder="1:30" className="h-8 text-xs text-center flex-1" />
                  <button type="button" onClick={() => { const d = parseTimeInput(timeInput); const m = d + 15; setTimeInput(`${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`); }} className="grid h-8 w-8 place-items-center rounded border border-border hover:bg-panel-2 text-dim"><Plus className="h-3 w-3" /></button>
                </div>
              </label>
              <Button type="submit" disabled={!canLog} loading={log.isPending} className="w-full mt-1">
                <Plus className="h-4 w-4" /> {t('log')}
              </Button>
            </form>
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
                            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary w-[88px] text-center inline-block truncate">{w.type}</span>
                            <span className="text-[11px] truncate">{w.description || '—'}</span>
                          </div>
                          <span className="shrink-0 text-[10px] text-dim">{w.startedAt ? new Date(w.startedAt).toLocaleDateString() : ''}</span>
                          <span className="shrink-0 text-[11px] font-semibold text-primary tabular-nums w-12 text-right">{fmtMin(w.durationMinutes)}</span>
                          <button type="button" onClick={() => deleteWorklog.mutate(w.id)} className="shrink-0 rounded p-0.5 text-muted opacity-0 group-hover:opacity-100 hover:text-danger transition-all">
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

/* ---- Attachments Tab ---- */
function AttachmentsTab({ ticketId, userName }: { ticketId: number; userName: (uid: number | null) => string }) {
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

  const prevDataRef = useRef<typeof data>(null);
  if (data && data !== prevDataRef.current) {
    prevDataRef.current = data;
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
      toast.success('Anexo removido');
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
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao remover anexo')),
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

      {isLoading ? (
        <LoadingState label={t('loading')} />
      ) : !data || data.length === 0 ? (
        <p className="text-sm text-dim">{t('empty')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data.map((a) => {
            const isImg = isImage(a.contentType);
            const thumbUrl = thumbnailUrls[a.id];
            const isLoadingThumb = loadingThumbnails.has(a.id);
            const hasFailed = failedThumbnails.has(a.id);
            
            return (
              <div key={a.id} className="card-surface overflow-hidden group">
                <div
                  className={cn(
                    'relative bg-panel-2 flex items-center justify-center cursor-pointer h-28',
                  )}
                  onClick={() => isImg ? openPreview(a) : downloadOne(a)}
                >
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
                    <div className="flex flex-col items-center gap-1 text-dim">
                      <FileText className="h-6 w-6" />
                      <span className="text-[9px]">PDF</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-dim">
                      <FileText className="h-6 w-6" />
                      <span className="text-[9px] uppercase">{a.contentType.split('/')[1]?.slice(0, 4) || 'FILE'}</span>
                    </div>
                  )}
                </div>

                <div className="px-2.5 py-2 flex items-start gap-1.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium leading-tight" title={a.fileName}>{a.fileName}</p>
                    <p className="text-[9px] text-dim">{fmtSize(a.fileSize)}</p>
                    {a.createdAt && <p className="text-[9px] text-dim">{formatDateTime(a.createdAt, { locale, timeZone })}</p>}
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" onClick={() => downloadOne(a)} className="rounded p-0.5 text-muted hover:bg-panel-2 hover:text-text" title={t('download')}>
                      <Download className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => deleteAttachment.mutate(a.id)} className="rounded p-0.5 text-muted hover:bg-danger/10 hover:text-danger" title={t('delete')}>
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
const EVIDENCE_HINTS: Record<EvidenceTypeValue, { ph: string; suggestions: string[]; needsUrl: boolean }> = {
  [EvidenceType.Screenshot]: { ph: 'O que aparece na captura?', suggestions: ['Tela de erro 500', 'Modal de pagamento', 'Console do navegador'], needsUrl: false },
  [EvidenceType.Log]: { ph: 'Trecho relevante do log…', suggestions: ['Stack trace', 'Linha de exceção', 'Resposta da API'], needsUrl: false },
  [EvidenceType.Video]: { ph: 'Descreva o que o vídeo demonstra', suggestions: ['Passos para reproduzir', 'Comportamento esperado vs real'], needsUrl: true },
  [EvidenceType.File]: { ph: 'Descrição do arquivo anexo', suggestions: ['Dump de banco', 'Configuração exportada'], needsUrl: false },
  [EvidenceType.Observation]: { ph: 'O que foi observado?', suggestions: ['Reproduz somente em produção', 'Ocorre após login', 'Intermitente'], needsUrl: false },
  [EvidenceType.Url]: { ph: 'Por que esta URL é relevante?', suggestions: ['Issue relacionada', 'Documento de referência', 'Endpoint afetado'], needsUrl: true },
};

function InvestigationTab({ ticketId, investigations }: { ticketId: number; investigations: InvestigationResponse[] }) {
  const t = useTranslations('investigation');
  const qc = useQueryClient();
  const [summary, setSummary] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] });

  const create = useMutation({
    mutationFn: () => investigationsApi.create(ticketId, { summary: summary.trim() }),
    onSuccess: () => { setSummary(''); invalidate(); toast.success(t('create')); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro')),
  });

  // Estatísticas
  const totalHypotheses = investigations.reduce((acc, inv) => acc + inv.hypotheses.length, 0);
  const totalFindings = investigations.reduce((acc, inv) => acc + inv.findingItems.length, 0);
  const totalEvidences = investigations.reduce((acc, inv) => acc + inv.evidences.length, 0);
  const activeInvestigations = investigations.filter(inv => !inv.finishedAt).length;

  return (
    <div className="flex flex-col gap-lg">
      {/* Cabeçalho com métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-sm">
        <div className="card-surface p-md text-center">
          <FlaskConical className="h-5 w-5 text-primary mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-text">{investigations.length}</p>
          <p className="text-[10px] uppercase tracking-wide text-dim">{t('investigations')}</p>
        </div>
        <div className="card-surface p-md text-center">
          <HelpCircle className="h-5 w-5 text-amber-600 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-text">{totalHypotheses}</p>
          <p className="text-[10px] uppercase tracking-wide text-dim">{t('hypotheses')}</p>
        </div>
        <div className="card-surface p-md text-center">
          <ListChecks className="h-5 w-5 text-blue-600 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-text">{totalFindings}</p>
          <p className="text-[10px] uppercase tracking-wide text-dim">{t('findings')}</p>
        </div>
        <div className="card-surface p-md text-center">
          <Link2 className="h-5 w-5 text-purple-600 mx-auto mb-1.5" />
          <p className="text-2xl font-bold text-text">{totalEvidences}</p>
          <p className="text-[10px] uppercase tracking-wide text-dim">{t('evidences')}</p>
        </div>
      </div>

      {/* Nova investigação */}
      <Can permission="investigation.create">
        <div className="card-surface p-lg">
          <div className="flex items-center gap-3 mb-md">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-text">{t('newInvestigation')}</h4>
              <p className="text-xs text-dim">{t('newInvestigationHint')}</p>
            </div>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); if (summary.trim()) create.mutate(); }} className="flex items-center gap-sm">
            <input 
              className={FIELD_MD + ' flex-1'} 
              value={summary} 
              onChange={(e) => setSummary(e.target.value)} 
              placeholder={t('newPh')} 
            />
            <Button type="submit" disabled={!summary.trim()} loading={create.isPending}>
              <Plus className="h-4 w-4" /> {t('start')}
            </Button>
          </form>
        </div>
      </Can>

      {/* Lista de investigações */}
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
        <div className="flex flex-col gap-md">
          {investigations.map((inv) => (
            <InvestigationCard key={inv.id} inv={inv} onChanged={invalidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function InvestigationCard({ inv, onChanged }: { inv: InvestigationResponse; onChanged: () => void }) {
  const t = useTranslations('investigation');
  const finished = !!inv.finishedAt;
  const [hyp, setHyp] = useState('');
  const [finding, setFinding] = useState('');
  const [evType, setEvType] = useState<EvidenceTypeValue>(EvidenceType.Observation);
  const [evNotes, setEvNotes] = useState('');
  const [evUrl, setEvUrl] = useState('');

  const run = (p: Promise<unknown>, ok?: () => void) =>
    p.then(() => { onChanged(); ok?.(); }).catch((e) => toast.error(apiErrorMessage(e, 'Erro')));

  const evHint = EVIDENCE_HINTS[evType];
  const datalistId = `inv-${inv.id}-ev-suggestions`;

  const hypothesisStatusStyle = (status: string) => {
    switch(status) {
      case 'Confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Discarded': return 'bg-slate-100 text-slate-500 border-slate-200 line-through';
      default: return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const confirmedCount = inv.hypotheses.filter(h => h.status === 'Confirmed').length;
  const progressPercent = inv.hypotheses.length > 0 
    ? Math.round((confirmedCount / inv.hypotheses.length) * 100) 
    : 0;

  return (
    <div className={cn(
      'card-surface overflow-hidden transition-all',
      finished ? 'opacity-75' : 'ring-1 ring-primary/20'
    )}>
      {/* Cabeçalho do card */}
      <div className="bg-panel-2/30 border-b border-border p-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-lg',
              finished ? 'bg-emerald-50' : 'bg-primary/10'
            )}>
              <FlaskConical className={cn('h-5 w-5', finished ? 'text-emerald-600' : 'text-primary')} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-sm font-semibold text-text truncate">{inv.summary}</h4>
                <span className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border',
                  finished 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                )}>
                  {finished ? t('finished') : t('inProgress')}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-dim">
                <span className="inline-flex items-center gap-1">
                  <HelpCircle className="h-3 w-3" />
                  {inv.hypotheses.length} {t('hypotheses')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <ListChecks className="h-3 w-3" />
                  {inv.findingItems.length} {t('findings')}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3 w-3" />
                  {inv.evidences.length} {t('evidences')}
                </span>
              </div>
            </div>
          </div>
          {!finished && (
            <Can permission="investigation.finish">
              <Button size="sm" variant="secondary" onClick={() => run(investigationsApi.finish(inv.id))}>
                <Check className="h-3.5 w-3.5" /> {t('finish')}
              </Button>
            </Can>
          )}
        </div>

        {/* Barra de progresso da investigação */}
        {inv.hypotheses.length > 0 && (
          <div className="mt-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-dim">{t('analysisProgress')}</span>
              <span className="text-[10px] font-medium text-text">{progressPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div 
                className={cn(
                  'h-full rounded-full transition-all',
                  progressPercent === 100 ? 'bg-emerald-500' : 'bg-primary'
                )}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Corpo do card - Grid de 3 colunas */}
      <div className="grid gap-0 md:grid-cols-3 divide-x divide-border">
        {/* Coluna de Hipóteses */}
        <div className="p-lg">
          <div className="flex items-center gap-2 mb-md">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-amber-50">
              <HelpCircle className="h-3.5 w-3.5 text-amber-600" />
            </div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-dim">{t('hypotheses')}</h5>
          </div>

          <div className="flex flex-col gap-2">
            {inv.hypotheses.length === 0 ? (
              <p className="text-xs text-dim italic py-2">{t('noHypotheses')}</p>
            ) : (
              inv.hypotheses.map((h) => (
                <div key={h.id} className={cn(
                  'rounded-lg border p-2.5 text-xs',
                  hypothesisStatusStyle(h.status)
                )}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="flex-1">{h.description}</p>
                    <Can permission="investigation.hypothesis.update" fallback={
                      <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold bg-white/50">
                        {t(`hStatus.${h.status}` as 'hStatus.Open')}
                      </span>
                    }>
                      <select 
                        value={HypothesisStatus[h.status as keyof typeof HypothesisStatus] ?? HypothesisStatus.Open}
                        onChange={(e) => run(investigationsApi.updateHypothesisStatus(h.id, Number(e.target.value) as HypothesisStatusValue))}
                        className="shrink-0 rounded border-0 bg-white/50 px-1.5 py-0.5 text-[9px] font-semibold outline-none cursor-pointer"
                      >
                        {Object.entries(HypothesisStatus).map(([k, v]) => (
                          <option key={k} value={v}>{t(`hStatus.${k}` as 'hStatus.Open')}</option>
                        ))}
                      </select>
                    </Can>
                  </div>
                </div>
              ))
            )}
          </div>

          {!finished && (
            <Can permission="investigation.hypothesis.add">
              <form onSubmit={(e) => { e.preventDefault(); if (hyp.trim()) run(investigationsApi.addHypothesis(inv.id, { description: hyp.trim() }), () => setHyp('')); }} className="mt-3">
                <input 
                  className={FIELD_SM} 
                  value={hyp} 
                  onChange={(e) => setHyp(e.target.value)} 
                  placeholder={t('addHypothesis')} 
                />
              </form>
            </Can>
          )}
        </div>

        {/* Coluna de Achados */}
        <div className="p-lg">
          <div className="flex items-center gap-2 mb-md">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-blue-50">
              <ListChecks className="h-3.5 w-3.5 text-blue-600" />
            </div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-dim">{t('findings')}</h5>
          </div>

          <div className="flex flex-col gap-2">
            {inv.findingItems.length === 0 ? (
              <p className="text-xs text-dim italic py-2">{t('noFindings')}</p>
            ) : (
              inv.findingItems.map((f) => (
                <div key={f.id} className="rounded-lg border border-blue-100 bg-blue-50/50 p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <p className="flex-1 text-text">{f.description}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {!finished && (
            <Can permission="investigation.finding.add">
              <form onSubmit={(e) => { e.preventDefault(); if (finding.trim()) run(investigationsApi.addFinding(inv.id, { description: finding.trim() }), () => setFinding('')); }} className="mt-3">
                <input 
                  className={FIELD_SM} 
                  value={finding} 
                  onChange={(e) => setFinding(e.target.value)} 
                  placeholder={t('addFinding')} 
                />
              </form>
            </Can>
          )}
        </div>

        {/* Coluna de Evidências */}
        <div className="p-lg">
          <div className="flex items-center gap-2 mb-md">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-purple-50">
              <Link2 className="h-3.5 w-3.5 text-purple-600" />
            </div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-dim">{t('evidences')}</h5>
          </div>

          <div className="flex flex-col gap-2">
            {inv.evidences.length === 0 ? (
              <p className="text-xs text-dim italic py-2">{t('noEvidences')}</p>
            ) : (
              inv.evidences.map((ev) => (
                <div key={ev.id} className="rounded-lg border border-purple-100 bg-purple-50/50 p-2.5 text-xs">
                  <div className="flex items-start gap-2">
                    <div className="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-purple-800">{t(`eType.${ev.type}` as 'eType.Log')}</span>
                      {ev.notes && <p className="text-dim mt-0.5">{ev.notes}</p>}
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline mt-1">
                          <ExternalLink className="h-3 w-3" />
                          <span className="truncate">{ev.url}</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {!finished && (
            <Can permission="investigation.evidence.add">
              <form onSubmit={(e) => { 
                e.preventDefault(); 
                run(investigationsApi.addEvidence(inv.id, { 
                  type: evType, 
                  notes: evNotes.trim() || null, 
                  url: evHint.needsUrl ? (evUrl.trim() || null) : null 
                }), () => { setEvNotes(''); setEvUrl(''); }); 
              }} className="mt-3 flex flex-col gap-2">
                <Select<EvidenceTypeValue> 
                  value={evType} 
                  onChange={(v) => { setEvType(v); setEvNotes(''); setEvUrl(''); }} 
                  options={Object.entries(EvidenceType).map(([k, v]) => ({ 
                    value: v as EvidenceTypeValue, 
                    label: t(`eType.${k}` as 'eType.Log') 
                  }))} 
                  className="text-xs"
                />
                <input 
                  list={datalistId} 
                  className={FIELD_SM} 
                  value={evNotes} 
                  onChange={(e) => setEvNotes(e.target.value)} 
                  placeholder={evHint.ph} 
                />
                <datalist id={datalistId}>
                  {evHint.suggestions.map((s) => <option key={s} value={s} />)}
                </datalist>
                {evHint.needsUrl && (
                  <input type="url" className={FIELD_SM} value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder={t('url')} />
                )}
                <Button type="submit" size="sm" variant="secondary" className="self-start">
                  <Plus className="h-3.5 w-3.5" /> {t('add')}
                </Button>
              </form>
            </Can>
          )}
        </div>
      </div>
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
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro')),
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

                  {rc.description && (
                    <p className="text-xs text-dim mb-lg leading-relaxed">{rc.description}</p>
                  )}

                  {/* Rodapé com ações */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <Button size="sm" variant="ghost" className="text-xs">
                      <Eye className="h-3.5 w-3.5" /> {t('viewDetails')}
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

/* ---- Intelligence Panel ---- */
function IntelligencePanel({ ticketId }: { ticketId: number }) {
  const t = useTranslations('intelligence');
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['tickets', 'intelligence', ticketId],
    queryFn: () => intelligenceApi.ticketReport(ticketId),
  });

  const reanalyze = useMutation({
    mutationFn: () => intelligenceApi.ticketReport(ticketId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tickets', 'intelligence', ticketId] }); toast.success('Análise atualizada'); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Erro ao reanalisar')),
  });

  if (isLoading) return <LoadingState label={t('analyzing')} />;
  if (isError || !data) return <ErrorState title={t('analysisError')} onRetry={() => refetch()} retryLabel={t('retry')} />;

  const hasRootCauses = data.rootCauseCandidates.length > 0;
  const hasResolutions = data.resolutionSuggestions.length > 0;

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">{t('title')}</h2>
        <Button size="sm" variant="secondary" onClick={() => reanalyze.mutate()} loading={reanalyze.isPending}>
          <Sparkles className="h-4 w-4" /> {t('analyzeAgain')}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-md">
        <div className="card-surface p-md text-center">
          <Target className="h-5 w-5 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold text-text">{data.rootCauseCandidates.length}</p>
          <p className="text-[10px] uppercase text-dim">{t('rootCauses')}</p>
        </div>
        <div className="card-surface p-md text-center">
          <Lightbulb className="h-5 w-5 text-warning mx-auto mb-1" />
          <p className="text-2xl font-bold text-text">{data.resolutionSuggestions.length}</p>
          <p className="text-[10px] uppercase text-dim">{t('resolutions')}</p>
        </div>
        <div className="card-surface p-md text-center">
          <TrendingUp className="h-5 w-5 text-success mx-auto mb-1" />
          <p className="text-2xl font-bold text-text">
            {data.resolutionSuggestions.length > 0
              ? `${Math.round(data.resolutionSuggestions.reduce((acc, r) => acc + r.successRate, 0) / data.resolutionSuggestions.length * 100)}%`
              : '—'}
          </p>
          <p className="text-[10px] uppercase text-dim">{t('avgSuccess')}</p>
        </div>
      </div>

      {hasRootCauses && (
        <section>
          <div className="flex items-center gap-2 mb-sm">
            <GitBranch className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-semibold">{t('rootCausesFound', { count: data.rootCauseCandidates.length })}</h3>
          </div>
          <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
            {data.rootCauseCandidates.map((c, i) => (
              <div key={i} className="card-surface p-md">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary uppercase">{c.category}</span>
                    {c.aiEnhanced && <span className="inline-flex items-center gap-1 text-[10px] text-primary"><Sparkles className="h-3 w-3" /> {t('ai')}</span>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-primary">{Math.round(c.confidenceScore * 100)}%</p>
                    <p className="text-[9px] text-dim uppercase">{t('confidence')}</p>
                  </div>
                </div>
                <p className="text-sm text-text mb-3">{c.description}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => toast.info(t('detailsComingSoon'))}>
                    <Eye className="h-3.5 w-3.5" /> {t('viewDetails')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toast.info(t('applyComingSoon'))}>
                    <Zap className="h-3.5 w-3.5" /> {t('createFromRootCause')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {hasResolutions && (
        <section>
          <div className="flex items-center gap-2 mb-sm">
            <Lightbulb className="h-5 w-5 text-warning" />
            <h3 className="text-sm font-semibold">{t('resolutionsFound', { count: data.resolutionSuggestions.length })}</h3>
          </div>
          <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
            {data.resolutionSuggestions.map((r) => (
              <div key={r.resolutionId} className="card-surface p-md">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-sm font-medium text-text flex-1">{r.summary}</p>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-success">{Math.round(r.similarityScore * 100)}%</p>
                    <p className="text-[9px] text-dim uppercase">{t('similar')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-dim mb-3">
                  <span>{t('reused', { count: r.reusedCount })}</span>
                  <span>{t('success')} {Math.round(r.successRate * 100)}%</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => toast.info(t('applyComingSoon'))}>
                    <Check className="h-3.5 w-3.5" /> {t('applySolution')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toast.info(t('applyComingSoon'))}>
                    <ExternalLink className="h-3.5 w-3.5" /> {t('linkToKnowledge')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!hasRootCauses && !hasResolutions && (
        <div className="flex flex-col items-center gap-3 py-12 text-dim">
          <BarChart3 className="h-12 w-12" />
          <p className="text-sm">{t('noData')}</p>
          <p className="text-xs">{t('noDataHint')}</p>
        </div>
      )}

      <p className="text-[10px] text-dim text-center">{t('aiDisclaimer')}</p>
    </div>
  );
}

type CommentFilter = 'all' | 'public' | 'internal';

function Conversation({ ticketId, comments, userName, locale, timeZone }: { ticketId: number; comments: { id: number; userId: number; message: string; isInternal: boolean; createdAt: string | null }[]; userName: (id: number | null) => string; locale: Locale; timeZone: string }) {
  const t = useTranslations('comments');
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);
  const [filter, setFilter] = useState<CommentFilter>('all');

  const add = useMutation({
    mutationFn: () => ticketsApi.addComment(ticketId, text.trim(), internal),
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['tickets', 'detail', ticketId] }); },
    onError: (err) => toast.error(apiErrorMessage(err, t('addError'))),
  });

  const filtered = comments.filter((c) => filter === 'all' ? true : filter === 'internal' ? c.isInternal : !c.isInternal);
  const counts = { all: comments.length, public: comments.filter((c) => !c.isInternal).length, internal: comments.filter((c) => c.isInternal).length };

  return (
    <div className="flex h-full w-full flex-col gap-md">
      <div className="flex items-center gap-1 text-xs">
        {(['all', 'public', 'internal'] as CommentFilter[]).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={cn('rounded-full border px-2.5 py-1 transition-colors', filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted hover:text-text')}>
            {t(`filter.${f}`)} · {counts[f]}
          </button>
        ))}
      </div>

      <div className="flex flex-1 flex-col gap-sm">
        {filtered.length === 0 ? (
          <p className="text-sm text-dim">{t('empty')}</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className={cn('card-surface p-md', c.isInternal ? 'border-warning/40 bg-warning/5' : 'border-l-2 border-l-primary/40')}>
              <div className="mb-1 flex items-center gap-sm text-xs text-muted">
                <span className="font-medium text-text">{userName(c.userId)}</span>
                {c.isInternal ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-1.5 py-0.5 text-warning"><Lock className="h-3 w-3" /> {t('internal')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-primary">{t('public')}</span>
                )}
                {c.createdAt && <span className="text-dim">{formatDateTime(c.createdAt, { locale, timeZone })}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm">{c.message}</p>
            </div>
          ))
        )}
      </div>

      <Can permission="ticket.comment.add">
        <div className={cn('card-surface p-md', internal && 'border-warning/40 bg-warning/5')}>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={internal ? t('placeholderInternal') : t('placeholderPublic')} className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-dim" />
          <div className="mt-sm flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
              <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
              <Lock className="h-3 w-3" /> {t('internalToggle')}
            </label>
            <Button size="sm" disabled={!text.trim() || add.isPending} loading={add.isPending} onClick={() => add.mutate()}>
              <Send className="h-3.5 w-3.5" /> {t('submit')}
            </Button>
          </div>
        </div>
      </Can>
    </div>
  );
}