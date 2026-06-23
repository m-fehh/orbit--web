'use client';

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useTranslations } from 'next-intl';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  AlertCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/utils';
import { Checkbox } from '@/shared/ui/checkbox';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  field: string;
  header: string;
  width?: number;
  minWidth?: number;
  resizable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'number' | 'date';
  filterOptions?: { label: string; value: string }[];
  render?: (value: any, row: T, index: number) => ReactNode;
  sticky?: 'left' | 'right';
  hidden?: boolean;
  align?: 'left' | 'center' | 'right';
  headerClassName?: string;
  cellClassName?: string;
}

export interface SortDescriptor {
  field: string;
  direction: 'asc' | 'desc';
}

export type TextFilterOperator = 'contains' | 'startsWith' | 'equals';
export type NumberFilterOperator = '=' | '>' | '<' | '>=' | '<=';

export type FilterValue =
  | { type: 'text'; operator: TextFilterOperator; value: string }
  | { type: 'select'; values: string[] }
  | { type: 'number'; operator: NumberFilterOperator; value: number | null }
  | { type: 'date'; from: string | null; to: string | null };

export interface BulkAction {
  label: string;
  icon?: LucideIcon;
  action: (ids: Set<string | number>) => void;
  tone?: 'danger' | 'primary';
}

export interface DataGridLabels {
  showing: string;
  of: string;
  noData: string;
  loading: string;
  errorDefault: string;
  retry: string;
  refresh: string;
  exportCsv: string;
  page: string;
  pageSize: string;
  first: string;
  last: string;
  previous: string;
  next: string;
  selectAll: string;
  selectedCount: string;
  filterContains: string;
  filterStartsWith: string;
  filterEquals: string;
  filterFrom: string;
  filterTo: string;
  filterApply: string;
  filterClear: string;
  emptyHint: string;
}

const DEFAULT_LABELS: DataGridLabels = {
  showing: 'Showing',
  of: 'of',
  noData: 'No data found',
  loading: 'Loading...',
  errorDefault: 'An error occurred',
  retry: 'Retry',
  refresh: 'Refresh',
  exportCsv: 'Export CSV',
  page: 'Page',
  pageSize: 'Page size',
  first: 'First',
  last: 'Last',
  previous: 'Previous',
  next: 'Next',
  selectAll: 'Select all',
  selectedCount: '{count} selected',
  filterContains: 'Contains',
  filterStartsWith: 'Starts with',
  filterEquals: 'Equals',
  filterFrom: 'From',
  filterTo: 'To',
  filterApply: 'Apply',
  filterClear: 'Clear',
  emptyHint: 'Your data will appear here. Try adjusting filters or creating a new record.',
};

/**
 * Hook that builds translated DataGrid labels from the `dataGrid` i18n namespace.
 * Usage: `const labels = useDataGridLabels();` then `<DataGrid labels={labels} … />`
 */
export function useDataGridLabels(): DataGridLabels {
  const tGrid = useTranslations('dataGrid');
  return useMemo<DataGridLabels>(() => ({
    showing: tGrid('showing'),
    of: tGrid('of'),
    noData: tGrid('noData'),
    loading: tGrid('loading'),
    errorDefault: tGrid('errorDefault'),
    retry: tGrid('retry'),
    refresh: tGrid('refresh'),
    exportCsv: tGrid('exportCsv'),
    page: tGrid('page'),
    pageSize: tGrid('pageSize'),
    first: tGrid('first'),
    last: tGrid('last'),
    previous: tGrid('previous'),
    next: tGrid('next'),
    selectAll: tGrid('selectAll'),
    selectedCount: tGrid('selectedCount'),
    filterContains: tGrid('filterContains'),
    filterStartsWith: tGrid('filterStartsWith'),
    filterEquals: tGrid('filterEquals'),
    filterFrom: tGrid('filterFrom'),
    filterTo: tGrid('filterTo'),
    filterApply: tGrid('filterApply'),
    filterClear: tGrid('filterClear'),
    emptyHint: tGrid('emptyHint'),
  }), [tGrid]);
}

export interface DataGridProps<T extends Record<string, any>> {
  gridId: string;
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: string;
  totalCount?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortChange?: (sorts: SortDescriptor[]) => void;
  onFilterChange?: (filters: Record<string, FilterValue>) => void;
  onSelectionChange?: (selectedIds: Set<string | number>) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  toolbar?: ReactNode;
  selectable?: boolean;
  bulkActions?: BulkAction[];
  className?: string;
  emptyMessage?: string;
  emptyIcon?: LucideIcon;
  labels?: Partial<DataGridLabels>;
  pageSizeOptions?: number[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function loadPersistedState(gridId: string): {
  widths: Record<string, number>;
  sorts: SortDescriptor[];
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`datagrid-${gridId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function savePersistedState(
  gridId: string,
  widths: Record<string, number>,
  sorts: SortDescriptor[],
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `datagrid-${gridId}`,
      JSON.stringify({ widths, sorts }),
    );
  } catch {
    // quota exceeded — ignore
  }
}

function escapeCSV(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

// ---------------------------------------------------------------------------
// Skeleton rows
// ---------------------------------------------------------------------------

const SKELETON_WIDTHS = ['60%', '80%', '45%', '70%', '55%', '40%', '75%', '50%'];

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, r) => (
        <tr key={r} className="border-b border-border">
          {Array.from({ length: colCount }).map((_, c) => (
            <td key={c} className="px-4 py-3 md:px-3 md:py-2.5">
              <div
                className="h-3.5 rounded-md animate-pulse"
                style={{
                  width: SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length],
                  background: 'linear-gradient(90deg, var(--orbit-color-bg-subtle) 0%, var(--orbit-color-border) 50%, var(--orbit-color-bg-subtle) 100%)',
                  backgroundSize: '200% 100%',
                  animation: `shimmer 1.5s ease-in-out infinite`,
                  animationDelay: `${(r * 0.05) + (c * 0.03)}s`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }`}</style>
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter Popover
// ---------------------------------------------------------------------------

interface FilterPopoverProps {
  column: ColumnDef<any>;
  value: FilterValue | undefined;
  onApply: (value: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
  anchorRef?: React.RefObject<HTMLElement>;
}

function calcFilterPos(anchor: HTMLElement, popH: number, popW: number) {
  const rect = anchor.getBoundingClientRect();
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const gap = 4;
  const below = rect.bottom + gap;
  const above = rect.top - popH - gap;
  const top = (vh - below >= popH) ? below : Math.max(8, above);
  const left = Math.min(rect.left, vw - popW - 8);
  return { top, left: Math.max(8, left) };
}

function FilterPopover({
  column,
  value,
  onApply,
  onClear,
  onClose,
  labels,
  anchorRef,
}: FilterPopoverProps) {
  const filterType = column.filterType ?? 'text';
  const popoverRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (anchorRef?.current) {
      const popW = filterType === 'date' ? 260 : 224;
      const popH = filterType === 'select' ? 280 : 160;
      setPos(calcFilterPos(anchorRef.current, popH, popW));
    }
  }, [anchorRef, filterType]);

  // Close on outside click
  useEffect(() => {
    function handler(e: globalThis.MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const style: React.CSSProperties = { position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 };

  let body: React.ReactNode;
  if (filterType === 'text') {
    body = <TextFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} posStyle={style} posCls="" />;
  } else if (filterType === 'select') {
    body = <SelectFilterBody popoverRef={popoverRef} column={column} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} posStyle={style} posCls="" />;
  } else if (filterType === 'number') {
    body = <NumberFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} posStyle={style} posCls="" />;
  } else {
    body = <DateFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} posStyle={style} posCls="" />;
  }

  if (typeof document === 'undefined') return null;
  return createPortal(body, document.body);
}

// --- Text filter body ---
function TextFilterBody({
  popoverRef,
  value,
  onApply,
  onClear,
  onClose,
  labels,
  posStyle,
  posCls,
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
  posStyle?: React.CSSProperties;
  posCls?: string;
}) {
  const current = value?.type === 'text' ? value : null;
  const [op, setOp] = useState<TextFilterOperator>(current?.operator ?? 'contains');
  const [text, setText] = useState(current?.value ?? '');

  return (
    <div
      ref={popoverRef}
      style={posStyle}
      className={cn(posCls, 'w-56 rounded-lg border border-border bg-panel shadow-lg flex flex-col')}
    >
      <div className="p-3 flex flex-col gap-2">
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as TextFilterOperator)}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text outline-none cursor-pointer"
        >
          <option value="contains">{labels.filterContains}</option>
          <option value="startsWith">{labels.filterStartsWith}</option>
          <option value="equals">{labels.filterEquals}</option>
        </select>
        <input
          autoFocus
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && text.trim()) {
              onApply({ type: 'text', operator: op, value: text.trim() });
            }
          }}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text focus:border-primary outline-none"
          placeholder="..."
        />
      </div>
      <div className="border-t border-border px-3 py-2">
        <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (text.trim()) onApply({ type: 'text', operator: op, value: text.trim() }); }} labels={labels} />
      </div>
    </div>
  );
}

// --- Select filter body ---
function SelectFilterBody({
  popoverRef,
  column,
  value,
  onApply,
  onClear,
  onClose,
  labels,
  posStyle,
  posCls,
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  column: ColumnDef<any>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
  posStyle?: React.CSSProperties;
  posCls?: string;
}) {
  const current = value?.type === 'select' ? value : null;
  const [selected, setSelected] = useState<Set<string>>(new Set(current?.values ?? []));
  const options = column.filterOptions ?? [];

  const toggle = (val: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(val)) next.delete(val);
      else next.add(val);
      return next;
    });
  };

  return (
    <div
      ref={popoverRef}
      style={posStyle}
      className={cn(posCls, 'w-56 rounded-lg border border-border bg-panel shadow-lg flex flex-col')}
    >
      <div className="flex-1 overflow-y-auto px-2 py-2.5 flex flex-col gap-0.5 max-h-52">
        {options.map((opt) => (
          <div key={opt.value} className="rounded-md px-2.5 py-1.5 hover:bg-bg-subtle transition-colors">
            <Checkbox
              size="sm"
              checked={selected.has(opt.value)}
              onChange={() => toggle(opt.value)}
              label={opt.label}
            />
          </div>
        ))}
      </div>
      <div className="border-t border-border px-3 py-2">
        <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (selected.size > 0) onApply({ type: 'select', values: Array.from(selected) }); }} labels={labels} />
      </div>
    </div>
  );
}

// --- Number filter body ---
function NumberFilterBody({
  popoverRef,
  value,
  onApply,
  onClear,
  onClose,
  labels,
  posStyle,
  posCls,
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
  posStyle?: React.CSSProperties;
  posCls?: string;
}) {
  const current = value?.type === 'number' ? value : null;
  const [op, setOp] = useState<NumberFilterOperator>(current?.operator ?? '=');
  const [num, setNum] = useState<string>(current?.value != null ? String(current.value) : '');

  return (
    <div
      ref={popoverRef}
      style={posStyle}
      className={cn(posCls, 'w-56 rounded-lg border border-border bg-panel shadow-lg flex flex-col')}
    >
      <div className="p-3 flex flex-col gap-2">
        <select
          value={op}
          onChange={(e) => setOp(e.target.value as NumberFilterOperator)}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text outline-none cursor-pointer"
        >
          {(['=', '>', '<', '>=', '<='] as const).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <input
          autoFocus
          type="number"
          value={num}
          onChange={(e) => setNum(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && num !== '') {
              onApply({ type: 'number', operator: op, value: parseFloat(num) });
            }
          }}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text focus:border-primary outline-none"
        />
      </div>
      <div className="border-t border-border px-3 py-2">
        <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (num !== '') onApply({ type: 'number', operator: op, value: parseFloat(num) }); }} labels={labels} />
      </div>
    </div>
  );
}

// --- Date filter body ---
function DateFilterBody({
  popoverRef,
  value,
  onApply,
  onClear,
  onClose,
  labels,
  posStyle,
  posCls,
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
  posStyle?: React.CSSProperties;
  posCls?: string;
}) {
  const current = value?.type === 'date' ? value : null;
  const [from, setFrom] = useState(current?.from ?? '');
  const [to, setTo] = useState(current?.to ?? '');

  return (
    <div
      ref={popoverRef}
      style={posStyle}
      className={cn(posCls, 'w-64 rounded-lg border border-border bg-panel shadow-lg flex flex-col')}
    >
      <div className="p-3 flex flex-col gap-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-dim">{labels.filterFrom}</label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text focus:border-primary outline-none"
        />
        <label className="text-[10px] font-semibold uppercase tracking-wider text-dim">{labels.filterTo}</label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-bg-subtle text-text focus:border-primary outline-none"
        />
      </div>
      <div className="border-t border-border px-3 py-2">
        <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (from || to) onApply({ type: 'date', from: from || null, to: to || null }); }} labels={labels} />
      </div>
    </div>
  );
}

// --- Shared filter action buttons ---
function FilterActions({
  onClear,
  onApply,
  labels,
}: {
  onClear: () => void;
  onApply: () => void;
  labels: DataGridLabels;
}) {
  return (
    <div className="flex gap-2 justify-end">
      <button
        onClick={onClear}
        className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-bg-subtle text-muted transition-colors"
      >
        {labels.filterClear}
      </button>
      <button
        onClick={onApply}
        className="px-3 py-1.5 text-xs rounded-md bg-primary text-white hover:opacity-90 font-medium transition-colors"
      >
        {labels.filterApply}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------

export function DataGrid<T extends Record<string, any>>({
  gridId,
  columns: columnsProp,
  data,
  rowKey,
  totalCount,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  onSortChange,
  onFilterChange,
  onSelectionChange,
  onRefresh,
  onExport,
  onRowClick,
  rowClassName,
  loading = false,
  error = null,
  toolbar,
  selectable = false,
  bulkActions,
  className,
  emptyMessage,
  emptyIcon: EmptyIcon = Inbox,
  labels: labelsProp,
  pageSizeOptions = [10, 20, 50, 100],
}: DataGridProps<T>) {
  const i18nLabels = useDataGridLabels();
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...i18nLabels, ...labelsProp }),
    [i18nLabels, labelsProp],
  );

  // Visible columns
  const columns = useMemo(
    () => columnsProp.filter((c) => !c.hidden),
    [columnsProp],
  );

  // --- Persisted state ---
  const persistedRef = useRef(loadPersistedState(gridId));

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const persisted = persistedRef.current;
    for (const col of columnsProp) {
      initial[col.field] =
        persisted?.widths?.[col.field] ?? col.width ?? 150;
    }
    return initial;
  });

  const [sorts, setSorts] = useState<SortDescriptor[]>(
    () => persistedRef.current?.sorts ?? [],
  );

  const [filters, setFilters] = useState<Record<string, FilterValue>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
  const [openFilter, setOpenFilter] = useState<string | null>(null);
  const filterBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Persist widths + sorts
  useEffect(() => {
    savePersistedState(gridId, columnWidths, sorts);
  }, [gridId, columnWidths, sorts]);

  // Notify parent of sort changes (skip initial)
  const sortMountRef = useRef(true);
  useEffect(() => {
    if (sortMountRef.current) { sortMountRef.current = false; return; }
    onSortChange?.(sorts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorts]);

  // Notify parent of filter changes (skip initial)
  const filterMountRef = useRef(true);
  useEffect(() => {
    if (filterMountRef.current) { filterMountRef.current = false; return; }
    onFilterChange?.(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Notify parent of selection changes (skip initial)
  const selMountRef = useRef(true);
  useEffect(() => {
    if (selMountRef.current) { selMountRef.current = false; return; }
    onSelectionChange?.(selectedIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  // --- Sort ---
  const handleSort = useCallback(
    (field: string, e: ReactMouseEvent) => {
      setSorts((prev) => {
        if (e.shiftKey) {
          const idx = prev.findIndex((s) => s.field === field);
          if (idx >= 0) {
            const next = [...prev];
            if (next[idx].direction === 'asc') {
              next[idx] = { field, direction: 'desc' };
            } else {
              next.splice(idx, 1);
            }
            return next;
          }
          return [...prev, { field, direction: 'asc' }];
        }
        const existing = prev.find((s) => s.field === field);
        if (existing) {
          if (existing.direction === 'asc') return [{ field, direction: 'desc' }];
          return [];
        }
        return [{ field, direction: 'asc' }];
      });
    },
    [],
  );

  const getSortInfo = useCallback(
    (field: string) => {
      const idx = sorts.findIndex((s) => s.field === field);
      if (idx < 0) return null;
      return { direction: sorts[idx].direction, order: idx + 1, total: sorts.length };
    },
    [sorts],
  );

  // --- Filters ---
  const handleApplyFilter = useCallback((field: string, value: FilterValue) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setOpenFilter(null);
  }, []);

  const handleClearFilter = useCallback((field: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const hasActiveFilter = useCallback(
    (field: string) => field in filters,
    [filters],
  );

  // --- Client-side filter + sort ---
  const displayData = useMemo(() => {
    let result = data;

    const filterEntries = Object.entries(filters);
    if (filterEntries.length > 0) {
      result = result.filter((row) =>
        filterEntries.every(([field, fv]) => {
          const val = getNestedValue(row, field);
          if (fv.type === 'text') {
            const s = String(val ?? '').toLowerCase();
            const q = fv.value.toLowerCase();
            if (fv.operator === 'contains') return s.includes(q);
            if (fv.operator === 'startsWith') return s.startsWith(q);
            return s === q;
          }
          if (fv.type === 'select') {
            return fv.values.includes(String(val ?? ''));
          }
          if (fv.type === 'number') {
            const n = Number(val);
            if (isNaN(n)) return false;
            const target = fv.value ?? 0;
            if (fv.operator === '=') return n === target;
            if (fv.operator === '>') return n > target;
            if (fv.operator === '<') return n < target;
            if (fv.operator === '>=') return n >= target;
            return n <= target;
          }
          if (fv.type === 'date') {
            const d = val ? new Date(val as string).getTime() : 0;
            if (fv.from && d < new Date(fv.from).getTime()) return false;
            if (fv.to && d > new Date(fv.to).getTime() + 86400000) return false;
            return true;
          }
          return true;
        }),
      );
    }

    if (sorts.length > 0) {
      result = [...result].sort((a, b) => {
        for (const s of sorts) {
          const av = getNestedValue(a, s.field);
          const bv = getNestedValue(b, s.field);
          const cmp = av < bv ? -1 : av > bv ? 1 : 0;
          if (cmp !== 0) return s.direction === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return result;
  }, [data, filters, sorts]);

  // --- Selection ---
  const allPageIds = useMemo(
    () => displayData.map((row) => getNestedValue(row, rowKey) as string | number),
    [displayData, rowKey],
  );

  const allSelected = useMemo(
    () => displayData.length > 0 && allPageIds.every((id) => selectedIds.has(id)),
    [allPageIds, selectedIds, displayData.length],
  );

  const someSelected = useMemo(
    () => allPageIds.some((id) => selectedIds.has(id)) && !allSelected,
    [allPageIds, selectedIds, allSelected],
  );

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allPageIds.forEach((id) => next.delete(id));
      } else {
        allPageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allSelected, allPageIds]);

  const toggleSelect = useCallback((id: string | number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // --- Column resize ---
  const resizeRef = useRef<{
    field: string;
    startX: number;
    startWidth: number;
    minWidth: number;
  } | null>(null);

  const handleResizeStart = useCallback(
    (field: string, minWidth: number, e: ReactMouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        field,
        startX: e.clientX,
        startWidth: columnWidths[field] ?? 150,
        minWidth,
      };

      const onMouseMove = (ev: globalThis.MouseEvent) => {
        if (!resizeRef.current) return;
        const diff = ev.clientX - resizeRef.current.startX;
        const newWidth = Math.max(
          resizeRef.current.minWidth,
          resizeRef.current.startWidth + diff,
        );
        setColumnWidths((prev) => ({
          ...prev,
          [resizeRef.current!.field]: newWidth,
        }));
      };

      const onMouseUp = () => {
        resizeRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [columnWidths],
  );

  // --- Export CSV ---
  const handleExport = useCallback(() => {
    if (onExport) {
      onExport();
      return;
    }
    const header = columns.map((c) => escapeCSV(c.header)).join(',');
    const rows = displayData.map((row) =>
      columns
        .map((c) => escapeCSV(String(getNestedValue(row, c.field) ?? '')))
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${gridId}-export.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [onExport, columns, data, gridId]);

  // --- Pagination ---
  const hasActiveFilters = Object.keys(filters).length > 0;
  const total = hasActiveFilters ? displayData.length : (totalCount ?? displayData.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const range = 2;
    let start = Math.max(1, page - range);
    let end = Math.min(totalPages, page + range);

    if (end - start < range * 2) {
      if (start === 1) end = Math.min(totalPages, start + range * 2);
      else start = Math.max(1, end - range * 2);
    }

    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }, [page, totalPages]);

  // --- Sticky column positioning ---
  const stickyLeftOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let left = selectable ? 40 : 0;
    for (const col of columns) {
      if (col.sticky === 'left') {
        offsets[col.field] = left;
        left += columnWidths[col.field] ?? 150;
      }
    }
    return offsets;
  }, [columns, columnWidths, selectable]);

  const stickyRightOffsets = useMemo(() => {
    const offsets: Record<string, number> = {};
    let right = 0;
    for (let i = columns.length - 1; i >= 0; i--) {
      const col = columns[i];
      if (col.sticky === 'right') {
        offsets[col.field] = right;
        right += columnWidths[col.field] ?? 150;
      }
    }
    return offsets;
  }, [columns, columnWidths]);

  // --- Render ---
  const colCount = columns.length + (selectable ? 1 : 0);

  return (
    <div className={cn('flex flex-col rounded-lg border border-border bg-panel overflow-hidden', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-panel-2 flex-wrap">
        {toolbar}
        <div className="flex-1" />
        <span className="text-xs text-muted whitespace-nowrap">
          {labels.showing} {startRow}&ndash;{endRow} {labels.of} {total}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            title={labels.refresh}
            className="p-1.5 rounded hover:bg-bg-subtle text-muted hover:text-text transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={handleExport}
          title={labels.exportCsv}
          className="p-1.5 rounded hover:bg-bg-subtle text-muted hover:text-text transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table wrapper */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm border-collapse" style={{ minWidth: 'max-content' }}>
          <colgroup>
            {selectable && <col style={{ width: 40 }} />}
            {columns.map((col) => (
              <col key={col.field} style={{ width: columnWidths[col.field] ?? 150 }} />
            ))}
          </colgroup>

          <thead>
            <tr className="border-b border-border bg-panel-2">
              {selectable && (
                <th
                  className="px-2 py-2.5 text-center sticky left-0 z-20 bg-panel-2"
                  style={{ width: 40 }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={toggleSelectAll}
                    className="rounded border-border"
                    title={labels.selectAll}
                  />
                </th>
              )}

              {columns.map((col) => {
                const sortInfo = getSortInfo(col.field);
                const isResizable = col.resizable !== false;
                const isSortable = col.sortable !== false;
                const isFilterable = col.filterable === true;
                const isSticky = !!col.sticky;

                const stickyStyle: React.CSSProperties = isSticky
                  ? {
                      position: 'sticky',
                      [col.sticky!]: col.sticky === 'left'
                        ? stickyLeftOffsets[col.field] ?? 0
                        : stickyRightOffsets[col.field] ?? 0,
                      zIndex: 20,
                    }
                  : {};

                return (
                  <th
                    key={col.field}
                    className={cn(
                      'relative px-4 py-2.5 md:px-3 font-semibold text-muted whitespace-nowrap select-none',
                      isSticky && 'bg-panel-2',
                      col.align === 'center' && 'text-center',
                      col.align === 'right' && 'text-right',
                      col.headerClassName,
                    )}
                    style={{
                      ...stickyStyle,
                      width: columnWidths[col.field] ?? 150,
                    }}
                  >
                    <div
                      className={cn(
                        'flex items-center gap-1',
                        col.align === 'center' && 'justify-center',
                        col.align === 'right' && 'justify-end',
                      )}
                    >
                      <button
                        onClick={isSortable ? (e) => handleSort(col.field, e) : undefined}
                        className={cn(
                          'flex items-center gap-1 group',
                          isSortable && 'cursor-pointer hover:text-text',
                        )}
                      >
                        <span className="text-xs uppercase tracking-wide">{col.header}</span>
                        {isSortable && !sortInfo && (
                          <ChevronsUpDown className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 transition-opacity" />
                        )}
                        {sortInfo && (
                          <span className="flex items-center gap-0.5 text-primary">
                            {sortInfo.direction === 'asc' ? (
                              <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5" />
                            )}
                            {sortInfo.total > 1 && (
                              <span className="text-[10px] font-bold leading-none">
                                {sortInfo.order}
                              </span>
                            )}
                          </span>
                        )}
                      </button>

                      {isFilterable && (
                        <button
                          ref={(el) => { filterBtnRefs.current[col.field] = el; }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenFilter((prev) => (prev === col.field ? null : col.field));
                          }}
                          className={cn(
                            'relative p-0.5 rounded hover:bg-bg-subtle transition-colors',
                            hasActiveFilter(col.field) ? 'text-primary' : 'text-muted',
                          )}
                        >
                          <Filter className="h-3 w-3" />
                          {hasActiveFilter(col.field) && (
                            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          )}
                        </button>
                      )}
                    </div>

                    {openFilter === col.field && isFilterable && (
                      <FilterPopover
                        column={col}
                        value={filters[col.field]}
                        onApply={(v) => handleApplyFilter(col.field, v)}
                        onClear={() => handleClearFilter(col.field)}
                        onClose={() => setOpenFilter(null)}
                        labels={labels}
                        anchorRef={{ current: filterBtnRefs.current[col.field] } as React.RefObject<HTMLElement>}
                      />
                    )}

                    {isResizable && (
                      <div
                        onMouseDown={(e) =>
                          handleResizeStart(col.field, col.minWidth ?? 80, e)
                        }
                        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/40 transition-colors"
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {loading && <SkeletonRows colCount={colCount} />}

            {!loading && error && (
              <tr>
                <td colSpan={colCount} className="px-4 py-20 text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <div className="rounded-2xl bg-danger/5 p-5">
                      <AlertCircle className="h-10 w-10 text-danger/40" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-text">{error || labels.errorDefault}</p>
                    </div>
                    {onRefresh && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={onRefresh}
                        className="rounded-md border border-border bg-panel px-4 py-2 text-xs font-medium text-text shadow-sm transition-colors hover:bg-bg-subtle"
                      >
                        {labels.retry}
                      </motion.button>
                    )}
                  </motion.div>
                </td>
              </tr>
            )}

            {!loading && !error && displayData.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex flex-col items-center gap-5"
                  >
                    <motion.div
                      initial={{ scale: 0.85, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.1, duration: 0.6, type: 'spring', stiffness: 180 }}
                    >
                      <svg width="180" height="140" viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <linearGradient id="emptyGrad1" x1="40" y1="23" x2="140" y2="105">
                            <stop offset="0%" style={{ stopColor: 'var(--orbit-color-primary)', stopOpacity: 0.12 }} />
                            <stop offset="100%" style={{ stopColor: 'var(--orbit-color-primary)', stopOpacity: 0.03 }} />
                          </linearGradient>
                          <linearGradient id="emptyGrad2" x1="55" y1="42" x2="95" y2="92">
                            <stop offset="0%" style={{ stopColor: 'var(--orbit-color-panel)', stopOpacity: 1 }} />
                            <stop offset="100%" style={{ stopColor: 'var(--orbit-color-bg-subtle)', stopOpacity: 1 }} />
                          </linearGradient>
                        </defs>
                        {/* Shadow on floor */}
                        <motion.ellipse
                          cx="90" cy="122" rx="65" ry="7"
                          style={{ fill: 'var(--orbit-color-border)', opacity: 0.3 }}
                          animate={{ rx: [65, 70, 65] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Folder */}
                        <motion.path
                          d="M40 35h30l8-12h62a6 6 0 016 6v70a6 6 0 01-6 6H40a6 6 0 01-6-6V41a6 6 0 016-6z"
                          fill="url(#emptyGrad1)"
                          style={{ stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.15 }}
                          strokeWidth="1.2"
                          animate={{ y: [0, -2, 0] }}
                          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Document 1 */}
                        <motion.g
                          animate={{ y: [0, -4, 0], rotate: [-1.5, 0.5, -1.5] }}
                          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                        >
                          <rect x="55" y="42" width="40" height="50" rx="4" fill="url(#emptyGrad2)" style={{ stroke: 'var(--orbit-color-border)' }} strokeWidth="0.8" />
                          <rect x="62" y="52" width="26" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.25 }} />
                          <rect x="62" y="58" width="20" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.15 }} />
                          <rect x="62" y="64" width="23" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.15 }} />
                          <rect x="62" y="70" width="16" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.1 }} />
                        </motion.g>
                        {/* Document 2 */}
                        <motion.g
                          animate={{ y: [0, -3, 0], rotate: [1.5, -0.5, 1.5] }}
                          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                        >
                          <rect x="85" y="46" width="40" height="50" rx="4" fill="url(#emptyGrad2)" style={{ stroke: 'var(--orbit-color-border)' }} strokeWidth="0.8" />
                          <rect x="92" y="56" width="26" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.25 }} />
                          <rect x="92" y="62" width="18" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.15 }} />
                          <rect x="92" y="68" width="22" height="2.5" rx="1" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.15 }} />
                        </motion.g>
                        {/* Magnifying glass */}
                        <motion.g
                          animate={{ x: [0, 3, 0], y: [0, -2, 0] }}
                          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
                        >
                          <circle cx="130" cy="50" r="14" style={{ fill: 'var(--orbit-color-panel)', stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.3 }} strokeWidth="2" />
                          <circle cx="130" cy="50" r="10" style={{ stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.12 }} strokeWidth="1" fill="none" />
                          <line x1="140" y1="60" x2="150" y2="72" style={{ stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.3 }} strokeWidth="3" strokeLinecap="round" />
                        </motion.g>
                        {/* Sparkles */}
                        <motion.circle cx="50" cy="28" r="2" style={{ fill: 'var(--orbit-color-primary)', opacity: 0.3 }}
                          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.2, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <motion.circle cx="155" cy="35" r="1.5" style={{ fill: 'var(--orbit-color-warning, #f59e0b)', opacity: 0.4 }}
                          animate={{ opacity: [0, 0.6, 0], scale: [0.5, 1.2, 0.5] }}
                          transition={{ duration: 2.5, repeat: Infinity, delay: 0.7 }}
                        />
                        <motion.circle cx="38" cy="65" r="1.5" style={{ fill: 'var(--orbit-color-success, #22c55e)', opacity: 0.3 }}
                          animate={{ opacity: [0, 0.5, 0], scale: [0.5, 1.2, 0.5] }}
                          transition={{ duration: 2, repeat: Infinity, delay: 1.2 }}
                        />
                        {/* Small cross sparkle */}
                        <motion.g
                          animate={{ opacity: [0, 0.4, 0], rotate: [0, 90, 180] }}
                          transition={{ duration: 3, repeat: Infinity, delay: 0.4 }}
                          style={{ transformOrigin: '161px 80px' }}
                        >
                          <line x1="158" y1="80" x2="164" y2="80" style={{ stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.25 }} strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="161" y1="77" x2="161" y2="83" style={{ stroke: 'var(--orbit-color-primary)', strokeOpacity: 0.25 }} strokeWidth="1.5" strokeLinecap="round" />
                        </motion.g>
                      </svg>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                      className="space-y-1.5 text-center"
                    >
                      <p className="text-sm font-semibold text-text">{emptyMessage || labels.noData}</p>
                      <p className="max-w-[260px] text-xs leading-relaxed text-muted/60">{labels.emptyHint}</p>
                    </motion.div>
                  </motion.div>
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              displayData.map((row, rowIndex) => {
                const id = getNestedValue(row, rowKey) as string | number;
                const isSelected = selectedIds.has(id);

                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border transition-colors',
                      rowIndex % 2 === 1 && 'bg-bg-subtle/30',
                      'hover:bg-bg-subtle/60',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-primary/5',
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <td
                        className="px-2 py-2.5 text-center sticky left-0 z-10 bg-inherit"
                        style={{ width: 40 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(id)}
                          className="rounded border-border"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = getNestedValue(row, col.field);
                      const isSticky = !!col.sticky;

                      const stickyStyle: React.CSSProperties = isSticky
                        ? {
                            position: 'sticky',
                            [col.sticky!]: col.sticky === 'left'
                              ? stickyLeftOffsets[col.field] ?? 0
                              : stickyRightOffsets[col.field] ?? 0,
                            zIndex: 10,
                          }
                        : {};

                      return (
                        <td
                          key={col.field}
                          className={cn(
                            'px-4 py-2.5 md:px-3 text-text',
                            isSticky && 'bg-inherit',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right',
                            col.cellClassName,
                          )}
                          style={stickyStyle}
                        >
                          {col.render
                            ? col.render(value, row, rowIndex)
                            : (value != null ? String(value) : '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {onPageChange && (
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-border bg-panel-2 flex-wrap text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span>{labels.pageSize}:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange?.(Number(e.target.value))}
              className="px-1.5 py-1 rounded border border-border bg-bg-subtle text-text text-xs"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <span>
            {labels.page} {page} / {totalPages}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(1)}
              disabled={page <= 1}
              title={labels.first}
              className="p-1 rounded hover:bg-bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              title={labels.previous}
              className="p-1 rounded hover:bg-bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {pageNumbers.map((p) => (
              <button
                key={p}
                onClick={() => onPageChange(p)}
                className={cn(
                  'min-w-[28px] h-7 px-1.5 rounded text-xs',
                  p === page
                    ? 'bg-primary text-white font-semibold'
                    : 'hover:bg-bg-subtle text-muted',
                )}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              title={labels.next}
              className="p-1 rounded hover:bg-bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onPageChange(totalPages)}
              disabled={page >= totalPages}
              title={labels.last}
              className="p-1 rounded hover:bg-bg-subtle disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Bulk actions bar */}
      {selectable && selectedIds.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="sticky bottom-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-2.5 border-t border-border bg-panel shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <span className="text-xs font-medium text-text">
            {labels.selectedCount.replace('{count}', String(selectedIds.size))}
          </span>
          <div className="flex items-center gap-2">
            {bulkActions.map((ba) => {
              const Icon = ba.icon;
              return (
                <button
                  key={ba.label}
                  onClick={() => ba.action(selectedIds)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors',
                    ba.tone === 'danger'
                      ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                      : 'bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                  {ba.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1 rounded hover:bg-bg-subtle text-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
