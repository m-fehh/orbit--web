'use client';

import { useState, useMemo, ReactNode } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

export interface Column<T> {
  key: keyof T;
  label: string;
  width?: string;
  render?: (value: any, row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  searchable?: boolean;
}

interface DataGridProps<T> {
  data: T[];
  columns: Column<T>[];
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  pageSize?: number;
  className?: string;
  emptyMessage?: string;
}

export function DataGrid<T extends Record<string, any>>({
  data,
  columns,
  rowKey,
  onRowClick,
  pageSize = 10,
  className,
  emptyMessage = 'Nenhum dado encontrado',
}: DataGridProps<T>) {
  const [sortBy, setSortBy] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Filtrar por busca global
  const searchableColumns = useMemo(
    () => columns.filter(c => c.searchable),
    [columns]
  );

  const filtered = useMemo(() => {
    let result = data;

    // Filtro global
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(row =>
        searchableColumns.some(col => {
          const val = row[col.key];
          return String(val).toLowerCase().includes(q);
        })
      );
    }

    // Filtros por coluna
    Object.entries(columnFilters).forEach(([key, value]) => {
      if (!value.trim()) return;
      result = result.filter(row => {
        const col = columns.find(c => String(c.key) === key);
        if (!col?.filterable) return true;
        const val = row[key as keyof T];
        return String(val).toLowerCase().includes(value.toLowerCase());
      });
    });

    // Sort
    if (sortBy) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal || '').toLowerCase();
        const bStr = String(bVal || '').toLowerCase();
        return sortDir === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return result;
  }, [data, search, columnFilters, sortBy, sortDir, columns, searchableColumns]);

  const paged = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize]
  );

  const totalPages = Math.ceil(filtered.length / pageSize);

  const handleSort = (key: keyof T) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('asc');
    }
    setPage(0);
  };

  const handleFilterChange = (key: string, value: string) => {
    setColumnFilters(f => ({ ...f, [key]: value }));
    setPage(0);
  };

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      {searchableColumns.length > 0 && (
        <div className="px-4 py-3 border-b border-border bg-panel/50 flex gap-3 items-center">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="flex-1 px-2 py-1 text-sm rounded border border-border bg-bg-subtle focus:border-primary outline-none"
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-panel/50">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  className="px-4 py-3 text-left font-semibold text-muted whitespace-nowrap"
                  style={{ width: col.width }}
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={cn(
                        'flex items-center gap-1 group',
                        col.sortable && 'cursor-pointer hover:text-text'
                      )}
                    >
                      <span>{col.label}</span>
                      {col.sortable && sortBy === col.key && (
                        <>
                          {sortDir === 'asc' ? (
                            <ChevronUp className="h-4 w-4 text-primary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-primary" />
                          )}
                        </>
                      )}
                      {col.sortable && sortBy !== col.key && (
                        <ChevronUp className="h-4 w-4 opacity-0 group-hover:opacity-50" />
                      )}
                    </button>
                  </div>
                  {col.filterable && (
                    <input
                      type="text"
                      placeholder="Filtrar..."
                      value={columnFilters[String(col.key)] || ''}
                      onChange={(e) => handleFilterChange(String(col.key), e.target.value)}
                      className="mt-2 w-full px-2 py-1 text-xs rounded border border-border bg-bg-subtle focus:border-primary outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-muted">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={String(row[rowKey])}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border hover:bg-panel/50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={String(col.key)}
                      className="px-4 py-3 text-text"
                      style={{ width: col.width }}
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] || '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-border bg-panel/50 flex items-center justify-between text-xs text-muted">
          <div>
            Mostrando {paged.length > 0 ? page * pageSize + 1 : 0}–
            {Math.min((page + 1) * pageSize, filtered.length)} de {filtered.length}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-3 py-1 rounded border border-border hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>
            <div className="flex items-center px-2">
              Página {page + 1} de {totalPages}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1 rounded border border-border hover:bg-panel disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
