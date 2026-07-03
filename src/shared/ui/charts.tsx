'use client';

/* ============================================================================
   ORBIT · CHART PRIMITIVES
   Gráficos SVG/CSS puros (sem dependência externa). Todas as cores vêm dos
   tokens do tema (var(--orbit-color-*)) para respeitar light/dark + whitelabel.
   ============================================================================ */

import { useId, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------------------

/** Fração 0..1 → "87%". */
export const formatPct = (n: number, digits = 0) =>
  `${((n ?? 0) * 100).toFixed(digits)}%`;

/** Horas decimais → "3h 12min" / "45min". */
export function formatHours(h: number): string {
  const total = Math.max(0, h ?? 0);
  const hrs = Math.floor(total);
  const mins = Math.round((total - hrs) * 60);
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}min`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}min`;
}

/** Minutos → "2h 30min" / "45min". */
export function formatMinutes(m: number): string {
  const total = Math.max(0, Math.round(m ?? 0));
  const hrs = Math.floor(total / 60);
  const mins = total % 60;
  if (hrs > 0 && mins > 0) return `${hrs}h ${mins}min`;
  if (hrs > 0) return `${hrs}h`;
  return `${mins}min`;
}

export const formatNumber = (n: number) => new Intl.NumberFormat().format(n ?? 0);

/** ISO → data curta no locale corrente. */
export function formatShortDate(iso: string, locale?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' });
}

// ---------------------------------------------------------------------------
// Paleta semântica de séries (cores de token quando possível)
// ---------------------------------------------------------------------------

export const SERIES_PALETTE = [
  'var(--orbit-color-primary)',
  'var(--orbit-color-success)',
  'var(--orbit-color-warning)',
  '#8b5cf6',
  '#f97316',
  'var(--orbit-color-info)',
  '#ec4899',
  '#14b8a6',
];

/** Cor de saúde por limiares (verde/âmbar/vermelho). */
export function healthColor(value: number, good = 0.9, warn = 0.75): string {
  if (value >= good) return 'var(--orbit-color-success)';
  if (value >= warn) return 'var(--orbit-color-warning)';
  return 'var(--orbit-color-danger)';
}
export function healthTextClass(value: number, good = 0.9, warn = 0.75): string {
  if (value >= good) return 'text-success';
  if (value >= warn) return 'text-warning';
  return 'text-danger';
}

// ---------------------------------------------------------------------------
// Sparkline — mini série de tendência
// ---------------------------------------------------------------------------

export function Sparkline({
  data,
  width = 96,
  height = 28,
  color = 'var(--orbit-color-primary)',
  fill = true,
  className,
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
}) {
  const gid = useId();
  if (!data || data.length < 2) return <div style={{ width, height }} className={className} />;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const toY = (v: number) => height - 3 - ((v - min) / range) * (height - 6);
  const pts = data.map((v, i) => `${(i * stepX).toFixed(1)},${toY(v).toFixed(1)}`);
  const line = pts.join(' ');
  const area = `0,${height} ${line} ${width},${height}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#spark-${gid})`} />
        </>
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Donut — distribuição proporcional
// ---------------------------------------------------------------------------

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  size = 168,
  thickness = 22,
  centerLabel,
  centerValue,
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: ReactNode;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center gap-lg">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img">
          <circle cx={c} cy={c} r={r} fill="none" stroke="var(--orbit-color-panel-2)" strokeWidth={thickness} />
          {total > 0 &&
            slices.map((s) => {
              const frac = s.value / total;
              const dash = frac * circ;
              const el = (
                <circle
                  key={s.label}
                  cx={c}
                  cy={c}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${c} ${c})`}
                />
              );
              offset += dash;
              return el;
            })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold leading-none text-text">{centerValue ?? total}</span>
          {centerLabel && <span className="mt-1 text-[10px] uppercase tracking-wide text-dim">{centerLabel}</span>}
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {slices.map((s) => {
          const frac = total > 0 ? s.value / total : 0;
          return (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-muted">{s.label}</span>
              <span className="font-semibold text-text">{s.value}</span>
              <span className="w-10 text-right text-xs text-dim">{formatPct(frac)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barras horizontais (com trilho + valor)
// ---------------------------------------------------------------------------

export interface BarItem {
  label: string;
  value: number;
  color?: string;
  /** Valor formatado a exibir (default = value). */
  display?: string;
}

export function HBarChart({ items, labelWidth = 112 }: { items: BarItem[]; labelWidth?: number }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center gap-3">
          <span
            className="shrink-0 truncate text-right text-xs text-muted"
            style={{ width: labelWidth }}
            title={item.label}
          >
            {item.label}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-panel-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((item.value / max) * 100, 2)}%`,
                backgroundColor: item.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length],
              }}
            />
          </div>
          <span className="w-12 shrink-0 text-right text-xs font-semibold text-text tabular-nums">
            {item.display ?? formatNumber(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de progresso fina (com cor semântica)
// ---------------------------------------------------------------------------

export function ProgressBar({
  value,
  color = 'var(--orbit-color-primary)',
  className,
}: {
  /** Fração 0..1. */
  value: number;
  color?: string;
  className?: string;
}) {
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-panel-2', className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line chart multi-série (para tendências)
// ---------------------------------------------------------------------------

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function LineChart({
  series,
  labels,
  height = 240,
  className,
}: {
  series: LineSeries[];
  labels: string[];
  height?: number;
  className?: string;
}) {
  const W = 720;
  const H = height;
  const PAD_L = 38;
  const PAD_R = 14;
  const PAD_T = 14;
  const PAD_B = 40;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;
  const n = labels.length;

  const maxVal = Math.max(1, ...series.flatMap((s) => s.values));
  const yTicks = 4;
  const xStep = n > 1 ? chartW / (n - 1) : chartW / 2;
  const toX = (i: number) => PAD_L + (n > 1 ? i * xStep : chartW / 2);
  const toY = (v: number) => PAD_T + chartH - (v / maxVal) * chartH;

  const labelStep = Math.max(1, Math.ceil(n / 8));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('h-auto w-full', className)} role="img">
      {/* grid + eixo Y */}
      {Array.from({ length: yTicks + 1 }).map((_, i) => {
        const yVal = (maxVal / yTicks) * i;
        const y = toY(yVal);
        return (
          <g key={i}>
            <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="var(--orbit-color-border)" strokeDasharray="3 4" />
            <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={10} fill="var(--orbit-color-dim)">
              {Math.round(yVal)}
            </text>
          </g>
        );
      })}
      {/* eixo X */}
      {labels.map((lb, i) =>
        i % labelStep === 0 || i === n - 1 ? (
          <text key={i} x={toX(i)} y={H - 20} textAnchor="middle" fontSize={10} fill="var(--orbit-color-dim)">
            {lb}
          </text>
        ) : null,
      )}
      {/* séries */}
      {series.map((s) => (
        <g key={s.key}>
          <polyline
            points={s.values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {s.values.map((v, i) => (
            <circle key={i} cx={toX(i)} cy={toY(v)} r={2.5} fill={s.color} />
          ))}
        </g>
      ))}
      {/* legenda */}
      {series.map((s, i) => (
        <g key={s.key} transform={`translate(${PAD_L + i * 110}, ${H - 4})`}>
          <circle cx={4} cy={-3} r={4} fill={s.color} />
          <text x={14} y={0} fontSize={11} fill="var(--orbit-color-muted)">
            {s.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Card / Section wrappers reutilizáveis
// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card-surface p-lg', className)}>
      <header className="mb-md flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        {action && <div className="ml-auto">{action}</div>}
      </header>
      {children}
    </section>
  );
}
