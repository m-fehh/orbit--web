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
import { cn } from '@/shared/lib/utils';

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
};

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

function SkeletonRows({ colCount }: { colCount: number }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, r) => (
        <tr key={r} className="border-b border-border">
          {Array.from({ length: colCount }).map((_, c) => (
            <td key={c} className="px-4 py-3 md:px-3 md:py-2.5">
              <div className="h-4 rounded bg-bg-subtle animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
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
}

function FilterPopover({
  column,
  value,
  onApply,
  onClear,
  onClose,
  labels,
}: FilterPopoverProps) {
  const filterType = column.filterType ?? 'text';
  const popoverRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

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

  if (filterType === 'text') {
    return <TextFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} />;
  }
  if (filterType === 'select') {
    return <SelectFilterBody popoverRef={popoverRef} column={column} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} />;
  }
  if (filterType === 'number') {
    return <NumberFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} />;
  }
  return <DateFilterBody popoverRef={popoverRef} value={value} onApply={onApply} onClear={onClear} onClose={onClose} labels={labels} />;
}

// --- Text filter body ---
function TextFilterBody({
  popoverRef,
  value,
  onApply,
  onClear,
  onClose,
  labels,
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
}) {
  const current = value?.type === 'text' ? value : null;
  const [op, setOp] = useState<TextFilterOperator>(current?.operator ?? 'contains');
  const [text, setText] = useState(current?.value ?? '');

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 top-full left-0 mt-1 w-56 rounded-lg border border-border bg-panel shadow-lg p-3 flex flex-col gap-2"
    >
      <select
        value={op}
        onChange={(e) => setOp(e.target.value as TextFilterOperator)}
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text"
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
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text focus:border-primary outline-none"
        placeholder="..."
      />
      <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (text.trim()) onApply({ type: 'text', operator: op, value: text.trim() }); }} labels={labels} />
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
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  column: ColumnDef<any>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
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
      className="absolute z-50 top-full left-0 mt-1 w-56 rounded-lg border border-border bg-panel shadow-lg p-3 flex flex-col gap-2 max-h-64 overflow-y-auto"
    >
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex items-center gap-2 text-xs text-text cursor-pointer hover:bg-bg-subtle rounded px-1 py-0.5"
        >
          <input
            type="checkbox"
            checked={selected.has(opt.value)}
            onChange={() => toggle(opt.value)}
            className="rounded border-border"
          />
          {opt.label}
        </label>
      ))}
      <div className="pt-1 border-t border-border mt-1">
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
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
}) {
  const current = value?.type === 'number' ? value : null;
  const [op, setOp] = useState<NumberFilterOperator>(current?.operator ?? '=');
  const [num, setNum] = useState<string>(current?.value != null ? String(current.value) : '');

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 top-full left-0 mt-1 w-56 rounded-lg border border-border bg-panel shadow-lg p-3 flex flex-col gap-2"
    >
      <select
        value={op}
        onChange={(e) => setOp(e.target.value as NumberFilterOperator)}
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text"
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
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text focus:border-primary outline-none"
      />
      <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (num !== '') onApply({ type: 'number', operator: op, value: parseFloat(num) }); }} labels={labels} />
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
}: {
  popoverRef: React.RefObject<HTMLDivElement>;
  value: FilterValue | undefined;
  onApply: (v: FilterValue) => void;
  onClear: () => void;
  onClose: () => void;
  labels: DataGridLabels;
}) {
  const current = value?.type === 'date' ? value : null;
  const [from, setFrom] = useState(current?.from ?? '');
  const [to, setTo] = useState(current?.to ?? '');

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 top-full left-0 mt-1 w-64 rounded-lg border border-border bg-panel shadow-lg p-3 flex flex-col gap-2"
    >
      <label className="text-xs text-muted">{labels.filterFrom}</label>
      <input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text focus:border-primary outline-none"
      />
      <label className="text-xs text-muted">{labels.filterTo}</label>
      <input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="w-full px-2 py-1.5 text-xs rounded border border-border bg-bg-subtle text-text focus:border-primary outline-none"
      />
      <FilterActions onClear={() => { onClear(); onClose(); }} onApply={() => { if (from || to) onApply({ type: 'date', from: from || null, to: to || null }); }} labels={labels} />
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
        className="px-2 py-1 text-xs rounded border border-border hover:bg-bg-subtle text-muted"
      >
        {labels.filterClear}
      </button>
      <button
        onClick={onApply}
        className="px-2 py-1 text-xs rounded bg-primary text-white hover:opacity-90"
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
  const labels = useMemo(
    () => ({ ...DEFAULT_LABELS, ...labelsProp }),
    [labelsProp],
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

  // --- Selection ---
  const allPageIds = useMemo(
    () => data.map((row) => getNestedValue(row, rowKey) as string | number),
    [data, rowKey],
  );

  const allSelected = useMemo(
    () => data.length > 0 && allPageIds.every((id) => selectedIds.has(id)),
    [allPageIds, selectedIds, data.length],
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
    const rows = data.map((row) =>
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
  const total = totalCount ?? data.length;
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
                <td colSpan={colCount} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertCircle className="h-8 w-8 text-red-400" />
                    <p className="text-sm text-muted">{error || labels.errorDefault}</p>
                    {onRefresh && (
                      <button
                        onClick={onRefresh}
                        className="px-3 py-1.5 text-xs rounded border border-border hover:bg-bg-subtle text-text"
                      >
                        {labels.retry}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={colCount} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <EmptyIcon className="h-8 w-8 text-muted/50" />
                    <p className="text-sm text-muted">{emptyMessage || labels.noData}</p>
                  </div>
                </td>
              </tr>
            )}

            {!loading &&
              !error &&
              data.map((row, rowIndex) => {
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
