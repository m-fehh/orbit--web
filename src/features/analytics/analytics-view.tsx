'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  RefreshCw,
  BarChart3,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Target,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { analyticsApi } from '@/shared/api/endpoints';
import type {
  DashboardSummary,
  TicketTrendPoint,
  TeamMetrics,
  SlaViolation,
} from '@/shared/api/types';
import { DataGrid, type ColumnDef } from '@/shared/ui/data-grid';

// ---------------------------------------------------------------------------
// Period & Granularity
// ---------------------------------------------------------------------------

type PeriodDays = 7 | 30 | 90;
type Granularity = 'Daily' | 'Weekly' | 'Monthly';

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle?: string;
  className?: string;
}

function KpiCard({ icon, label, value, subtitle, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-panel p-4 flex flex-col gap-1',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-muted text-xs font-medium uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold text-text">{value}</div>
      {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal Bar
// ---------------------------------------------------------------------------

interface HBarProps {
  items: { label: string; value: number; color: string }[];
}

function HBar({ items }: HBarProps) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className="text-xs text-muted w-28 truncate text-right">{item.label}</span>
          <div className="flex-1 h-5 bg-surface rounded overflow-hidden">
            <div
              className="h-full rounded transition-all"
              style={{
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
          <span className="text-xs font-medium text-text w-10 text-right">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG Trend Chart
// ---------------------------------------------------------------------------

interface TrendChartProps {
  data: TicketTrendPoint[];
  t: ReturnType<typeof useTranslations>;
}

function TrendChart({ data, t }: TrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted text-sm">
        {t('noData')}
      </div>
    );
  }

  const W = 700;
  const H = 260;
  const PAD_L = 40;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 50;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const maxVal = Math.max(...data.flatMap((d) => [d.opened, d.closed]), 1);
  const yTicks = 5;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  function toX(i: number) {
    return PAD_L + (data.length > 1 ? i * xStep : chartW / 2);
  }
  function toY(v: number) {
    return PAD_T + chartH - (v / maxVal) * chartH;
  }

  function polyline(key: 'opened' | 'closed') {
    return data.map((d, i) => `${toX(i)},${toY(d[key])}`).join(' ');
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  // Show at most ~10 labels on X axis
  const labelStep = Math.max(1, Math.floor(data.length / 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" style={{ maxHeight: 300 }}>
      {/* Y grid lines */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yVal = (maxVal / yTicks) * i;
        const y = toY(yVal);
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={y}
              x2={W - PAD_R}
              y2={y}
              stroke="var(--color-border)"
              strokeDasharray="3 3"
            />
            <text x={PAD_L - 6} y={y + 4} textAnchor="end" fontSize={10} fill="var(--color-muted)">
              {Math.round(yVal)}
            </text>
          </g>
        );
      })}

      {/* X labels */}
      {data.map((d, i) =>
        i % labelStep === 0 ? (
          <text
            key={i}
            x={toX(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="var(--color-muted)"
          >
            {formatDate(d.date)}
          </text>
        ) : null,
      )}

      {/* Lines */}
      <polyline
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth={2}
        points={polyline('opened')}
      />
      <polyline
        fill="none"
        stroke="var(--color-success)"
        strokeWidth={2}
        points={polyline('closed')}
      />

      {/* Dots */}
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={toX(i)} cy={toY(d.opened)} r={3} fill="var(--color-primary)" />
          <circle cx={toX(i)} cy={toY(d.closed)} r={3} fill="var(--color-success)" />
        </g>
      ))}

      {/* Legend */}
      <circle cx={PAD_L + 10} cy={H - 28} r={4} fill="var(--color-primary)" />
      <text x={PAD_L + 20} y={H - 24} fontSize={11} fill="var(--color-text)">
        {t('opened')}
      </text>
      <circle cx={PAD_L + 100} cy={H - 28} r={4} fill="var(--color-success)" />
      <text x={PAD_L + 110} y={H - 24} fontSize={11} fill="var(--color-text)">
        {t('closed')}
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const PRIORITY_COLORS: Record<string, string> = {
  Low: 'var(--color-success)',
  Medium: 'var(--color-warning)',
  High: '#f97316',
  Critical: 'var(--color-danger)',
};

const STATUS_COLORS: Record<string, string> = {
  New: 'var(--color-info)',
  Assigned: '#8b5cf6',
  InProgress: 'var(--color-primary)',
  PendingCustomer: 'var(--color-warning)',
  PendingInternal: '#f97316',
  Resolved: 'var(--color-success)',
  Closed: 'var(--color-muted)',
  Cancelled: '#6b7280',
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AnalyticsView() {
  const t = useTranslations('analytics');
  const [days, setDays] = useState<PeriodDays>(30);
  const [granularity, setGranularity] = useState<Granularity>('Daily');

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['analytics-dashboard', days],
    queryFn: () => analyticsApi.dashboard(days),
    staleTime: 60_000,
  });

  const { data: trendData } = useQuery({
    queryKey: ['analytics-trends', days, granularity],
    queryFn: () => analyticsApi.trends(days, granularity),
    staleTime: 60_000,
  });

  const { data: slaData } = useQuery({
    queryKey: ['analytics-sla', days],
    queryFn: () => analyticsApi.slaCompliance(days),
    staleTime: 60_000,
  });

  const kpis = dashboard?.kpis;
  const trend = trendData ?? dashboard?.trend ?? [];
  const teams = dashboard?.teams ?? [];
  const violations = slaData?.violations ?? [];

  // ---- Distribution items ----
  const priorityItems = useMemo(
    () =>
      Object.entries(dashboard?.ticketsByPriority ?? {}).map(([label, value]) => ({
        label,
        value,
        color: PRIORITY_COLORS[label] ?? 'var(--color-muted)',
      })),
    [dashboard],
  );

  const statusItems = useMemo(
    () =>
      Object.entries(dashboard?.ticketsByStatus ?? {}).map(([label, value]) => ({
        label,
        value,
        color: STATUS_COLORS[label] ?? 'var(--color-muted)',
      })),
    [dashboard],
  );

  const rootCauseItems = useMemo(
    () =>
      Object.entries(dashboard?.rootCausesByCategory ?? {}).map(([label, value], i) => ({
        label,
        value,
        color: ['var(--color-primary)', 'var(--color-warning)', 'var(--color-success)', '#8b5cf6', '#f97316', 'var(--color-info)'][i % 6],
      })),
    [dashboard],
  );

  // ---- Teams grid columns ----
  const teamColumns: ColumnDef<TeamMetrics>[] = useMemo(
    () => [
      { field: 'teamName', header: t('teamName'), sortable: true, minWidth: 140 },
      { field: 'totalTickets', header: t('totalTickets'), sortable: true, width: 100, align: 'right' as const },
      { field: 'resolvedTickets', header: t('resolved'), sortable: true, width: 100, align: 'right' as const },
      {
        field: 'resolutionRate',
        header: t('resolutionRate'),
        sortable: true,
        width: 120,
        align: 'right' as const,
        render: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
      {
        field: 'avgMttrHours',
        header: t('avgMttr'),
        sortable: true,
        width: 110,
        align: 'right' as const,
        render: (v: number) => `${v.toFixed(1)}h`,
      },
      {
        field: 'slaComplianceRate',
        header: t('slaCompliance'),
        sortable: true,
        width: 120,
        align: 'right' as const,
        render: (v: number) => `${(v * 100).toFixed(1)}%`,
      },
    ],
    [t],
  );

  // ---- SLA Violations grid columns ----
  const violationColumns: ColumnDef<SlaViolation>[] = useMemo(
    () => [
      { field: 'ticketNumber', header: t('ticketNumber'), sortable: true, width: 120 },
      { field: 'priority', header: t('priority'), sortable: true, width: 100 },
      {
        field: 'minutesOverdue',
        header: t('minutesOverdue'),
        sortable: true,
        width: 130,
        align: 'right' as const,
        render: (v: number) => {
          const h = Math.floor(v / 60);
          const m = v % 60;
          return h > 0 ? `${h}h ${m}m` : `${m}m`;
        },
      },
      {
        field: 'dueAt',
        header: t('dueAt'),
        sortable: true,
        width: 160,
        render: (v: string) => new Date(v).toLocaleString(),
      },
    ],
    [t],
  );

  // ---- Render ----

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted">
        <AlertTriangle size={32} />
        <p>{t('error')}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 rounded bg-primary text-white text-sm hover:opacity-90 transition"
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-[1400px] mx-auto h-full overflow-y-auto">
      {/* ---- Toolbar ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold text-text mr-auto">{t('title')}</h1>

        {/* Period presets */}
        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {([7, 30, 90] as PeriodDays[]).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'px-3 py-1.5 transition',
                days === d
                  ? 'bg-primary text-white'
                  : 'bg-panel text-text hover:bg-surface',
              )}
            >
              {d}d
            </button>
          ))}
        </div>

        {/* Granularity */}
        <select
          value={granularity}
          onChange={(e) => setGranularity(e.target.value as Granularity)}
          className="text-sm border border-border rounded-lg px-2 py-1.5 bg-panel text-text"
        >
          <option value="Daily">{t('daily')}</option>
          <option value="Weekly">{t('weekly')}</option>
          <option value="Monthly">{t('monthly')}</option>
        </select>

        {/* Refresh */}
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-1.5 rounded-lg border border-border bg-panel text-muted hover:text-text hover:bg-surface transition disabled:opacity-50"
        >
          <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ---- KPI Cards ---- */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg border border-border bg-panel animate-pulse" />
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <KpiCard
            icon={<BarChart3 size={14} />}
            label={t('totalTickets')}
            value={String(kpis.totalTickets)}
          />
          <KpiCard
            icon={<CheckCircle2 size={14} />}
            label={t('resolved')}
            value={String(kpis.resolvedTickets)}
          />
          <KpiCard
            icon={<Clock size={14} />}
            label={t('mttr')}
            value={`${kpis.mttrHours.toFixed(1)}h`}
            subtitle={t('mttrSubtitle')}
          />
          <KpiCard
            icon={<ShieldCheck size={14} />}
            label={t('slaCompliance')}
            value={`${(kpis.slaComplianceRate * 100).toFixed(1)}%`}
          />
          <KpiCard
            icon={<Target size={14} />}
            label={t('resolutionRate')}
            value={`${(kpis.resolutionRate * 100).toFixed(1)}%`}
          />
          <KpiCard
            icon={<RotateCcw size={14} />}
            label={t('recurrenceRate')}
            value={`${(kpis.recurrenceRate * 100).toFixed(1)}%`}
          />
        </div>
      ) : null}

      {/* ---- Trend Chart ---- */}
      <div className="rounded-lg border border-border bg-panel p-4">
        <h2 className="text-sm font-semibold text-text mb-3">{t('trendTitle')}</h2>
        <TrendChart data={trend} t={t} />
      </div>

      {/* ---- Distribution Panels ---- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold text-text mb-3">{t('byPriority')}</h2>
          {priorityItems.length ? <HBar items={priorityItems} /> : <p className="text-xs text-muted">{t('noData')}</p>}
        </div>
        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold text-text mb-3">{t('byStatus')}</h2>
          {statusItems.length ? <HBar items={statusItems} /> : <p className="text-xs text-muted">{t('noData')}</p>}
        </div>
        <div className="rounded-lg border border-border bg-panel p-4">
          <h2 className="text-sm font-semibold text-text mb-3">{t('byRootCause')}</h2>
          {rootCauseItems.length ? <HBar items={rootCauseItems} /> : <p className="text-xs text-muted">{t('noData')}</p>}
        </div>
      </div>

      {/* ---- Teams DataGrid ---- */}
      <div className="rounded-lg border border-border bg-panel p-4">
        <h2 className="text-sm font-semibold text-text mb-3">{t('teamsTitle')}</h2>
        <DataGrid<TeamMetrics>
          gridId="analytics-teams"
          columns={teamColumns}
          data={teams}
          rowKey="teamId"
          loading={isLoading}
        />
      </div>

      {/* ---- SLA Violations ---- */}
      <div className="rounded-lg border border-border bg-panel p-4">
        <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-warning" />
          {t('slaViolationsTitle')}
        </h2>
        {violations.length === 0 && !isLoading ? (
          <p className="text-xs text-muted">{t('noViolations')}</p>
        ) : (
          <DataGrid<SlaViolation>
            gridId="analytics-sla-violations"
            columns={violationColumns}
            data={violations}
            rowKey="ticketId"
            loading={isLoading}
          />
        )}
      </div>
    </div>
  );
}
