'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trophy, CheckCircle2, ShieldCheck, Medal, Target, Gift, Plus, Pencil, Trash2, Settings2, Crown, Zap, Flame, BookOpen, Timer, RotateCcw, Sparkles, Swords, BadgeCheck, Award, Lock, Activity, Check } from 'lucide-react';
import { gamificationApi } from '@/shared/api/endpoints';
import { apiErrorMessage, GoalMetric, type LeaderboardEntry, type GamificationGoalResponse, type GoalMetricName, type ScoreBreakdown, type AchievementResponse, type HistoryPoint, type GoalAchievementResponse, type TeamLeaderboardEntry } from '@/shared/api/types';
import { useAuthStore } from '@/features/auth/auth-store';
import { usePermissions } from '@/features/auth/use-permissions';
import { LoadingState, ErrorState, EmptyState } from '@/shared/ui/states';
import { Drawer } from '@/shared/ui/modal';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Select } from '@/shared/ui/select';
import { Checkbox } from '@/shared/ui/checkbox';
import { cn } from '@/shared/lib/utils';

/** Faixa (título) por nível — leve, profissional, sem infantilizar. */
function tierKey(level: number): 'starter' | 'skilled' | 'expert' | 'master' {
  if (level >= 7) return 'master';
  if (level >= 5) return 'expert';
  if (level >= 3) return 'skilled';
  return 'starter';
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Cores só para o pódio (top 3). Demais posições ficam neutras. */
const PODIUM: Record<number, { ring: string; badge: string; avatar: string }> = {
  1: { ring: 'ring-amber-400/50', badge: 'bg-amber-400 text-amber-950', avatar: 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950' },
  2: { ring: 'ring-slate-300/50', badge: 'bg-slate-300 text-slate-800', avatar: 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-800' },
  3: { ring: 'ring-orange-400/40', badge: 'bg-orange-400 text-orange-950', avatar: 'bg-gradient-to-br from-orange-300 to-orange-500 text-orange-950' },
};

export function PerformanceView() {
  const t = useTranslations('performance');
  const tc = useTranslations('common');
  const meId = useAuthStore((s) => s.user?.id);
  const { can } = usePermissions();
  const canManage = can('sla.manage');
  const [days, setDays] = useState(30);
  const [managing, setManaging] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['gamification', 'performance', days],
    queryFn: () => gamificationApi.performance(days),
    retry: false,
  });

  const me = data?.me;
  const progressPct = me
    ? me.isMaxLevel ? 100 : Math.min(100, Math.round((me.points / Math.max(1, me.nextLevelAt)) * 100))
    : 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-lg overflow-auto p-lg">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
          <Trophy className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-text">{t('title')}</h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
            {[30, 90].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors', days === d ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text')}
              >
                {t('periodDays', { days: d })}
              </button>
            ))}
          </div>
          {canManage && (
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setManaging(true)} data-tour="manage-goals">
              <Settings2 className="h-3.5 w-3.5" /> {t('manageGoals')}
            </Button>
          )}
        </div>
      </header>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState title={tc('errorBody')} onRetry={() => refetch()} retryLabel={tc('retry')} />
      ) : !data ? null : (
        <>
          {/* Meu desempenho */}
          {me && (
            <section data-tour="my-performance" className="card-surface overflow-hidden">
              <div className="flex flex-wrap items-center gap-6 p-lg">
                {/* Anel de nível */}
                {(() => {
                  const r = 32, circ = 2 * Math.PI * r;
                  return (
                    <div className="relative grid h-28 w-28 shrink-0 place-items-center">
                      <svg width="112" height="112" viewBox="0 0 112 112" className="-rotate-90">
                        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-panel-2)" strokeWidth="8" />
                        <circle cx="56" cy="56" r={r} fill="none" stroke="var(--color-primary)" strokeWidth="8" strokeLinecap="round"
                          strokeDasharray={circ} strokeDashoffset={circ * (1 - progressPct / 100)}
                          style={{ transition: 'stroke-dashoffset .6s ease' }} />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-dim">{t('level')}</span>
                        <span className="text-3xl font-bold leading-none text-text tabular-nums">{me.level}</span>
                        <span className="mt-0.5 text-[10px] font-medium text-primary">{t(`tier.${tierKey(me.level)}` as 'tier.starter')}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold text-text">{me.userName}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-semibold text-dim">
                      <Crown className="h-3 w-3" /> {t('rankNo', { rank: me.rank })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {me.isMaxLevel ? t('maxLevel') : t('toNextLevel', { points: me.pointsToNext, level: me.level + 1 })}
                  </p>
                  <div className="mt-2.5 h-2 w-full max-w-sm overflow-hidden rounded-full bg-panel-2">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-500" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* KPIs */}
                <div className="flex gap-2.5">
                  <Stat icon={Trophy} label={t('points')} value={me.points} accent="primary" />
                  <Stat icon={CheckCircle2} label={t('resolved')} value={me.resolved} />
                  <Stat icon={ShieldCheck} label={t('validated')} value={me.validated} accent="success" />
                </div>
              </div>

              {/* De onde vêm os pontos (qualidade > volume) */}
              <ScoreBreakdownStrip b={me.breakdown} t={t} />
            </section>
          )}

          {/* Evolução ao longo do tempo */}
          <HistoryCard />

          {/* Conquistas / selos */}
          <AchievementsSection />

          {/* Metas — progresso do analista (visão de todos) */}
          <GoalsPanel canManage={canManage} onManage={() => setManaging(true)} />

          {/* Premiações recebidas */}
          <MyAwardsStrip />

          {/* Ranking (indivíduo / equipe) */}
          <LeaderboardSection days={days} meId={meId} individual={data.leaderboard} participants={data.participants} />

          {/* Temporada + Hall da Fama */}
          <SeasonSection meId={meId} />

          <p className="text-xs text-dim">{t('howItWorks')}</p>
        </>
      )}

      {managing && <ManageGoalsDrawer onClose={() => setManaging(false)} />}
    </div>
  );
}

/* ───────── Metas: progresso do analista (todos veem) ───────── */

function GoalsPanel({ canManage, onManage }: { canManage: boolean; onManage: () => void }) {
  const t = useTranslations('performance');
  const { data } = useQuery({ queryKey: ['gamification', 'goals'], queryFn: () => gamificationApi.goals(), retry: false });
  const goals = data ?? [];

  // Sem metas e sem poder gerenciar → nem mostra o painel.
  if (goals.length === 0 && !canManage) return null;

  return (
    <section data-tour="goals" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Target className="h-4 w-4 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-text">{t('goalsTitle')}</p>
        </div>
      </div>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-lg py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary"><Target className="h-5 w-5" /></span>
          <p className="max-w-xs text-sm text-muted">{t('goalsEmpty')}</p>
          {canManage && (
            <Button size="sm" className="gap-1.5" onClick={onManage}><Plus className="h-3.5 w-3.5" /> {t('goalNew')}</Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 p-lg sm:grid-cols-2">
          {goals.map((g) => <GoalProgressCard key={g.id} g={g} t={t} />)}
        </div>
      )}
    </section>
  );
}

function GoalProgressCard({ g, t }: { g: GamificationGoalResponse; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className={cn(
      'relative rounded-xl border p-4 transition-colors',
      g.achieved ? 'border-success/40 bg-success/[0.06]' : 'border-border bg-panel-2/30',
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{g.name}</p>
          <p className="mt-0.5 text-[11px] text-dim">
            {t(`metric.${g.metric}` as 'metric.Points')} · {t('goalPeriodShort', { days: g.periodDays })}
          </p>
        </div>
        {g.achieved && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-bold text-success">
            <CheckCircle2 className="h-3 w-3" /> {t('goalAchieved')}
          </span>
        )}
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="text-xl font-bold tabular-nums text-text">{g.myValue}<span className="text-sm font-medium text-dim">/{g.target}</span></span>
        <span className="text-[11px] font-semibold tabular-nums text-dim">{g.progress}%</span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-panel-2">
        <div className={cn('h-full rounded-full transition-all duration-500', g.achieved ? 'bg-success' : 'bg-primary')} style={{ width: `${Math.min(100, g.progress)}%` }} />
      </div>

      {g.reward && (
        <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-amber-400/20 bg-amber-400/5 px-2.5 py-1.5">
          <Gift className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span className="truncate text-[11px] font-medium text-amber-600 dark:text-amber-400">{g.reward}</span>
        </div>
      )}
    </div>
  );
}

/* ───────── Gestão de metas (drawer lateral, só gestor) ───────── */

const METRIC_NUM: Record<GoalMetricName, number> = { Points: GoalMetric.Points, Resolved: GoalMetric.Resolved, Validated: GoalMetric.Validated };

function ManageGoalsDrawer({ onClose }: { onClose: () => void }) {
  const t = useTranslations('performance');
  const qc = useQueryClient();
  const [editing, setEditing] = useState<GamificationGoalResponse | 'new' | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['gamification', 'allGoals'], queryFn: () => gamificationApi.allGoals(), retry: false });
  const goals = data ?? [];

  const del = useMutation({
    mutationFn: (id: number) => gamificationApi.deleteGoal(id),
    onSuccess: () => {
      toast.success(t('goalDeleted'));
      qc.invalidateQueries({ queryKey: ['gamification', 'allGoals'] });
      qc.invalidateQueries({ queryKey: ['gamification', 'goals'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('goalError'))),
  });

  if (editing) {
    return <GoalForm goal={editing === 'new' ? null : editing} onBack={() => setEditing(null)} onClose={onClose} />;
  }

  return (
    <Drawer open onClose={onClose} title={t('manageGoals')} subtitle={t('manageGoalsSubtitle')}>
      <div className="flex flex-col gap-3">
        <Button className="w-full gap-1.5" onClick={() => setEditing('new')}><Plus className="h-4 w-4" /> {t('goalNew')}</Button>

        {isLoading ? (
          <LoadingState />
        ) : goals.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">{t('goalsEmpty')}</p>
        ) : (
          goals.map((g) => (
            <div key={g.id} className={cn('rounded-xl border p-3.5', g.active ? 'border-border bg-panel-2/30' : 'border-border/50 bg-panel-2/10 opacity-70')}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text">{g.name}</p>
                    {!g.active && <span className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-dim">{t('goalInactive')}</span>}
                  </div>
                  <p className="mt-0.5 text-[11px] text-dim">
                    {t(`metric.${g.metric}` as 'metric.Points')} · {t('goalTargetLabel', { target: g.target, days: g.periodDays })}
                  </p>
                  {g.reward && <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400"><Gift className="h-3 w-3" /> {g.reward}</p>}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button type="button" onClick={() => setEditing(g)} className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-panel-2 hover:text-text" aria-label={t('goalEdit')}><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => del.mutate(g.id)} className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-danger/10 hover:text-danger" aria-label={t('goalDelete')}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))
        )}

        <AwardsManager />
      </div>
    </Drawer>
  );
}

/** Concessão auditável de premiações (gestor) — dentro do drawer de gestão de metas. */
function AwardsManager() {
  const t = useTranslations('performance');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['gamification', 'awards'], queryFn: () => gamificationApi.awards(), retry: false });
  const awards = data ?? [];

  const grant = useMutation({
    mutationFn: (id: number) => gamificationApi.grantAward(id),
    onSuccess: () => {
      toast.success(t('awardGranted'));
      qc.invalidateQueries({ queryKey: ['gamification', 'awards'] });
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('goalError'))),
  });

  if (awards.length === 0) return null;

  return (
    <div className="mt-2 border-t border-border pt-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dim">{t('awardsToGrant')}</p>
      <div className="flex flex-col gap-2">
        {awards.map((a) => (
          <div key={a.id} className={cn('rounded-xl border p-3', a.awarded ? 'border-success/30 bg-success/[0.05]' : 'border-amber-400/30 bg-amber-400/[0.05]')}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">{a.userName}</p>
                <p className="truncate text-[11px] text-dim">{a.goalName}{a.reward ? ` · ${a.reward}` : ''}</p>
              </div>
              {a.awarded ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-[11px] font-bold text-success"><Check className="h-3.5 w-3.5" /> {t('awardDone')}</span>
              ) : (
                <Button size="sm" className="shrink-0 gap-1.5" loading={grant.isPending && grant.variables === a.id} onClick={() => grant.mutate(a.id)}>
                  <Gift className="h-3.5 w-3.5" /> {t('awardGrant')}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function GoalForm({ goal, onBack, onClose }: { goal: GamificationGoalResponse | null; onBack: () => void; onClose: () => void }) {
  const t = useTranslations('performance');
  const qc = useQueryClient();
  const [name, setName] = useState(goal?.name ?? '');
  const [metric, setMetric] = useState<number>(goal ? METRIC_NUM[goal.metric] : GoalMetric.Points);
  const [target, setTarget] = useState(goal ? String(goal.target) : '');
  const [periodDays, setPeriodDays] = useState(String(goal?.periodDays ?? 30));
  const [reward, setReward] = useState(goal?.reward ?? '');
  const [active, setActive] = useState(goal?.active ?? true);

  const save = useMutation({
    mutationFn: () => gamificationApi.saveGoal({
      id: goal?.id ?? null,
      name: name.trim(),
      metric,
      target: Number(target) || 0,
      periodDays: Number(periodDays) || 30,
      reward: reward.trim() || null,
      active,
    }),
    onSuccess: () => {
      toast.success(t('goalSaved'));
      qc.invalidateQueries({ queryKey: ['gamification', 'allGoals'] });
      qc.invalidateQueries({ queryKey: ['gamification', 'goals'] });
      onBack();
    },
    onError: (e) => toast.error(apiErrorMessage(e, t('goalError'))),
  });

  const invalid = name.trim() === '' || Number(target) <= 0;

  return (
    <Drawer
      open
      onClose={onClose}
      title={goal ? t('goalEditTitle') : t('goalNew')}
      subtitle={t('goalFormSubtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onBack}>{t('goalCancel')}</Button>
          <Button loading={save.isPending} disabled={invalid} onClick={() => save.mutate()}>{t('goalSave')}</Button>
        </>
      }
    >
      <div className="grid gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">{t('goalName')}</span>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('goalNamePh')} autoFocus />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">{t('goalMetric')}</span>
          <Select<number>
            value={metric}
            onChange={setMetric}
            options={[
              { value: GoalMetric.Points, label: t('metric.Points') },
              { value: GoalMetric.Resolved, label: t('metric.Resolved') },
              { value: GoalMetric.Validated, label: t('metric.Validated') },
            ]}
          />
          <span className="text-[11px] text-dim">{t('goalMetricHint')}</span>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('goalTarget')}</span>
            <Input type="number" min={1} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-dim">{t('goalPeriod')}</span>
            <Input type="number" min={7} value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} placeholder="30" />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-dim">{t('goalReward')}</span>
          <Input value={reward} onChange={(e) => setReward(e.target.value)} placeholder={t('goalRewardPh')} />
          <span className="text-[11px] text-dim">{t('goalRewardHint')}</span>
        </label>

        <div className="rounded-lg border border-border bg-panel-2/30 px-3.5 py-3">
          <Checkbox checked={active} onChange={(e) => setActive(e.currentTarget.checked)} label={t('goalActive')} description={t('goalActiveHint')} />
        </div>
      </div>
    </Drawer>
  );
}

/* ───────── Blocos auxiliares ───────── */

/* ───────── Histórico de evolução (área SVG) ───────── */

function HistoryCard() {
  const t = useTranslations('performance');
  const { data } = useQuery({ queryKey: ['gamification', 'history'], queryFn: () => gamificationApi.history(90), retry: false });
  if (!data || data.points.length === 0 || data.totalPoints === 0) return null;

  return (
    <section data-tour="history" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Activity className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-text">{t('historyTitle')}</p>
        <span className="ml-auto text-[11px] text-dim">{t('historyTotals', { points: data.totalPoints, resolved: data.totalResolved })}</span>
      </div>
      <div className="p-lg">
        <AreaChart points={data.points} />
      </div>
    </section>
  );
}

function AreaChart({ points }: { points: HistoryPoint[] }) {
  const W = 640, H = 120, pad = 4;
  const max = Math.max(1, ...points.map((p) => p.points));
  const n = points.length;
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * (W - pad * 2) + pad);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.points).toFixed(1)}`).join(' ');
  const area = `${line} L${x(n - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-28 w-full" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient id="perfArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#perfArea)" />
      <path d={line} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => p.points > 0 && (
        <circle key={i} cx={x(i)} cy={y(p.points)} r="2.5" fill="var(--color-primary)" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

/* ───────── Premiações recebidas (analista) ───────── */

function MyAwardsStrip() {
  const t = useTranslations('performance');
  const { data } = useQuery({ queryKey: ['gamification', 'myAwards'], queryFn: () => gamificationApi.myAwards(), retry: false });
  const awards = data ?? [];
  if (awards.length === 0) return null;

  return (
    <section className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Gift className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-bold text-text">{t('awardsReceived')}</p>
      </div>
      <ul className="divide-y divide-border/40">
        {awards.map((a) => (
          <li key={a.id} className="flex items-center gap-3 px-lg py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950"><Gift className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{a.reward || a.goalName}</p>
              <p className="text-[11px] text-dim">{a.goalName}</p>
            </div>
            {a.awardedAt && <span className="shrink-0 text-[11px] text-dim">{new Date(a.awardedAt).toLocaleDateString()}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ───────── Conquistas (selos por marcos) ───────── */

const ACHIEVEMENT_ICON: Record<string, typeof Trophy> = {
  'first-resolution': Sparkles,
  centurion: Swords,
  curator: BookOpen,
  'quality-seal': BadgeCheck,
  'sla-guardian': Timer,
  'critical-slayer': Flame,
};

function AchievementsSection() {
  const t = useTranslations('performance');
  const { data } = useQuery({ queryKey: ['gamification', 'achievements'], queryFn: () => gamificationApi.achievements(), retry: false });
  const items = data ?? [];
  if (items.length === 0) return null;

  const earned = items.filter((a) => a.earned).length;

  return (
    <section data-tour="achievements" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Award className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-text">{t('achievementsTitle')}</p>
        <span className="ml-auto text-[11px] font-semibold tabular-nums text-dim">{t('achievementsCount', { earned, total: items.length })}</span>
      </div>
      <div className="grid gap-3 p-lg sm:grid-cols-2 lg:grid-cols-3">
        {items.map((a) => <AchievementCard key={a.key} a={a} t={t} />)}
      </div>
    </section>
  );
}

function AchievementCard({ a, t }: { a: AchievementResponse; t: ReturnType<typeof useTranslations> }) {
  const Icon = ACHIEVEMENT_ICON[a.key] ?? Trophy;
  return (
    <div className={cn(
      'relative flex gap-3 rounded-xl border p-3.5 transition-colors',
      a.earned ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/10 to-transparent' : 'border-border bg-panel-2/20',
    )}>
      <span className={cn(
        'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
        a.earned ? 'bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950' : 'bg-panel-2 text-dim',
      )}>
        {a.earned ? <Icon className="h-5 w-5" /> : <Lock className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-semibold', a.earned ? 'text-text' : 'text-muted')}>{t(`achievement.${a.key}.name` as 'achievement.centurion.name')}</p>
        <p className="mt-0.5 line-clamp-2 text-[11px] text-dim">{t(`achievement.${a.key}.desc` as 'achievement.centurion.desc')}</p>
        {!a.earned && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${a.progress}%` }} />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-dim">{a.current}/{a.target}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────── Temporada + Hall da Fama ───────── */

function SeasonSection({ meId }: { meId?: number }) {
  const t = useTranslations('performance');
  const { data } = useQuery({ queryKey: ['gamification', 'season'], queryFn: () => gamificationApi.season(), retry: false });
  if (!data) return null;

  const leader = data.leaderboard[0];
  const hall = data.hallOfFame;
  if (!leader && hall.length === 0) return null;

  return (
    <section data-tour="season" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Crown className="h-4 w-4 text-amber-500" />
        <p className="text-sm font-bold text-text">{t('seasonTitle')}</p>
        <span className="ml-auto rounded-full bg-panel-2 px-2 py-0.5 text-[11px] font-medium text-dim">{monthLabel(data.currentLabel, t)}</span>
      </div>

      <div className="p-lg">
        {/* Líder atual da temporada */}
        {leader ? (
          <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-gradient-to-r from-amber-400/10 to-transparent p-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-sm font-bold text-amber-950 ring-2 ring-amber-400/40">
              {initials(leader.userName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">{t('seasonLeading')}</p>
              <p className="truncate text-sm font-bold text-text">{leader.userName}{leader.userId === meId && <span className="ml-1.5 text-[11px] font-medium text-primary">· {t('you')}</span>}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-lg font-bold tabular-nums text-text">{leader.points}</p>
              <p className="text-[9px] font-medium uppercase tracking-wider text-dim">{t('points')}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">{t('seasonEmpty')}</p>
        )}

        {/* Hall da Fama */}
        {hall.length > 0 && (
          <>
            <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wider text-dim">{t('hallOfFame')}</p>
            <ul className="space-y-2">
              {hall.map((h) => (
                <li key={h.label} className="flex items-center gap-3 rounded-lg border border-border bg-panel-2/20 px-3 py-2">
                  <Medal className="h-4 w-4 shrink-0 text-amber-500" />
                  <span className="w-24 shrink-0 text-[11px] font-medium text-dim">{monthLabel(h.label, t)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{h.userName}</span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-primary">{h.points} {t('pts')}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Formata "yyyy-MM" no mês/ano do locale. */
function monthLabel(iso: string, t: ReturnType<typeof useTranslations>): string {
  const [y, m] = iso.split('-').map(Number);
  if (!y || !m) return iso;
  const months = t.raw('months') as string[];
  const name = Array.isArray(months) ? months[m - 1] : String(m);
  return `${name} ${y}`;
}

/** Composição do score — mostra que qualidade pesa mais que volume, de forma transparente. */
function ScoreBreakdownStrip({ b, t }: { b: ScoreBreakdown; t: ReturnType<typeof useTranslations> }) {
  const items = [
    { key: 'volume', icon: Zap, value: b.volume, color: 'bg-slate-400', text: 'text-slate-500' },
    { key: 'priority', icon: Flame, value: b.priority, color: 'bg-orange-400', text: 'text-orange-500' },
    { key: 'validation', icon: ShieldCheck, value: b.validation, color: 'bg-success', text: 'text-success' },
    { key: 'knowledge', icon: BookOpen, value: b.knowledge, color: 'bg-primary', text: 'text-primary' },
    { key: 'sla', icon: Timer, value: b.sla, color: 'bg-sky-400', text: 'text-sky-500' },
  ] as const;
  const positive = items.filter((i) => i.value > 0);
  const totalPos = positive.reduce((s, i) => s + i.value, 0);
  const penalty = b.reopenPenalty; // já vem negativo

  // Nada pontuado ainda → não polui a tela.
  if (totalPos === 0 && penalty === 0) return null;

  return (
    <div className="border-t border-border px-lg py-3.5">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">{t('breakdownTitle')}</p>
      {/* Barra empilhada */}
      {totalPos > 0 && (
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-panel-2">
          {positive.map((i) => (
            <div key={i.key} className={cn('h-full', i.color)} style={{ width: `${(i.value / totalPos) * 100}%` }} title={t(`breakdown.${i.key}` as 'breakdown.volume')} />
          ))}
        </div>
      )}
      {/* Legenda */}
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
        {positive.map((i) => (
          <span key={i.key} className="inline-flex items-center gap-1.5 text-[11px]">
            <i.icon className={cn('h-3.5 w-3.5', i.text)} />
            <span className="text-muted">{t(`breakdown.${i.key}` as 'breakdown.volume')}</span>
            <span className="font-semibold tabular-nums text-text">+{i.value}</span>
          </span>
        ))}
        {penalty < 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <RotateCcw className="h-3.5 w-3.5 text-danger" />
            <span className="text-muted">{t('breakdown.reopen')}</span>
            <span className="font-semibold tabular-nums text-danger">{penalty}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof Trophy; label: string; value: number; accent?: 'primary' | 'success' }) {
  return (
    <div className="min-w-[78px] rounded-xl border border-border bg-panel-2/40 px-3 py-2.5 text-center">
      <Icon className={cn('mx-auto mb-1 h-4 w-4', accent === 'primary' ? 'text-primary' : accent === 'success' ? 'text-success' : 'text-dim')} />
      <p className="text-lg font-bold leading-none tabular-nums text-text">{value}</p>
      <p className="mt-1 text-[9px] font-medium uppercase tracking-wider text-dim">{label}</p>
    </div>
  );
}

/* ───────── Ranking: indivíduo ↔ equipe ───────── */

function LeaderboardSection({ days, meId, individual, participants }: {
  days: number;
  meId?: number;
  individual: LeaderboardEntry[];
  participants: number;
}) {
  const t = useTranslations('performance');
  const [mode, setMode] = useState<'individual' | 'team'>('individual');

  const { data: teamData } = useQuery({
    queryKey: ['gamification', 'teams', days],
    queryFn: () => gamificationApi.teams(days),
    enabled: mode === 'team',
    retry: false,
  });
  const teams = teamData?.teams ?? [];

  return (
    <section data-tour="leaderboard" className="card-surface overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-lg py-3.5">
        <Medal className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold text-text">{t('leaderboard')}</p>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-bg-subtle p-0.5">
          {(['individual', 'team'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn('rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors', mode === m ? 'bg-primary text-primary-fg' : 'text-muted hover:text-text')}
            >
              {t(m === 'individual' ? 'boardIndividual' : 'boardTeams')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'individual' ? (
        individual.length === 0 ? (
          <EmptyState icon={Trophy} message={t('empty')} />
        ) : (
          <>
            {participants > 0 && <p className="px-lg pt-2.5 text-[11px] text-dim">{t('participants', { count: participants })}</p>}
            <ul className="divide-y divide-border/40">
              {individual.map((e) => (
                <LeaderRow key={e.userId} e={e} isMe={e.userId === meId} topPoints={individual[0].points} t={t} />
              ))}
            </ul>
          </>
        )
      ) : teams.length === 0 ? (
        <EmptyState icon={Trophy} message={t('teamsEmpty')} />
      ) : (
        <ul className="divide-y divide-border/40">
          {teams.map((tm) => (
            <TeamRow key={tm.teamId} tm={tm} topPoints={teams[0].points} t={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function TeamRow({ tm, topPoints, t }: { tm: TeamLeaderboardEntry; topPoints: number; t: ReturnType<typeof useTranslations> }) {
  const podium = PODIUM[tm.rank];
  const barPct = topPoints > 0 ? Math.max(4, Math.round((tm.points / topPoints) * 100)) : 0;
  return (
    <li className="flex items-center gap-3 px-lg py-3">
      <div className="relative shrink-0">
        <span className={cn('grid h-10 w-10 place-items-center rounded-xl text-xs font-bold ring-2 ring-offset-1 ring-offset-panel',
          podium ? podium.avatar : 'bg-panel-2 text-muted', podium ? podium.ring : 'ring-border')}>
          {initials(tm.teamName)}
        </span>
        <span className={cn('absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-panel',
          podium ? podium.badge : 'bg-panel-2 text-dim')}>
          {tm.rank}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <span className="truncate text-sm font-semibold text-text">{tm.teamName}</span>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-panel-2">
            <div className={cn('h-full rounded-full', tm.rank === 1 ? 'bg-amber-400' : 'bg-primary/70')} style={{ width: `${barPct}%` }} />
          </div>
          <span className="text-[10px] text-dim">{t('teamMembers', { count: tm.members })} · {t('resolvedCount', { count: tm.resolved })}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-base font-bold tabular-nums text-text">{tm.points}</p>
        <p className="text-[9px] font-medium uppercase tracking-wider text-dim">{t('points')}</p>
      </div>
    </li>
  );
}

function LeaderRow({ e, isMe, topPoints, t }: {
  e: LeaderboardEntry;
  isMe: boolean;
  topPoints: number;
  t: ReturnType<typeof useTranslations>;
}) {
  const podium = PODIUM[e.rank];
  const barPct = topPoints > 0 ? Math.max(4, Math.round((e.points / topPoints) * 100)) : 0;
  return (
    <li className={cn('flex items-center gap-3 px-lg py-3 transition-colors', isMe && 'bg-primary/[0.06]')}>
      {/* Avatar com iniciais + medalha para o pódio */}
      <div className="relative shrink-0">
        <span className={cn(
          'grid h-10 w-10 place-items-center rounded-full text-xs font-bold ring-2 ring-offset-1 ring-offset-panel',
          podium ? podium.avatar : 'bg-panel-2 text-muted',
          podium ? podium.ring : 'ring-border',
        )}>
          {initials(e.userName)}
        </span>
        <span className={cn(
          'absolute -bottom-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold ring-2 ring-panel',
          podium ? podium.badge : 'bg-panel-2 text-dim',
        )}>
          {e.rank}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-text">{e.userName}</span>
          {isMe && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold text-primary">{t('you')}</span>}
          <span className="rounded-full bg-panel-2 px-1.5 py-0.5 text-[10px] font-medium text-dim">{t(`tier.${tierKey(e.level)}` as 'tier.starter')}</span>
        </div>
        {/* Barra relativa ao líder */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="h-1.5 max-w-[220px] flex-1 overflow-hidden rounded-full bg-panel-2">
            <div className={cn('h-full rounded-full', e.rank === 1 ? 'bg-amber-400' : 'bg-primary/70')} style={{ width: `${barPct}%` }} />
          </div>
          <span className="text-[10px] text-dim">{t('resolvedCount', { count: e.resolved })}</span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-bold tabular-nums text-text">{e.points}</p>
        <p className="text-[9px] font-medium uppercase tracking-wider text-dim">{t('points')}</p>
      </div>
    </li>
  );
}
