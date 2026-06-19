'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import type { SortDescriptor, FilterValue } from './data-grid';
import type { PagedResponse } from '@/shared/api/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DataGridQueryParams {
  page: number;
  pageSize: number;
  sort: SortDescriptor[];
  filters: Record<string, FilterValue>;
  search: string;
}

export interface UseDataGridQueryOptions<T> {
  /** Unique key for TanStack Query (e.g. ['tickets']). Grid params are appended automatically. */
  queryKey: unknown[];
  /** Fetch function that receives grid params and returns a paged response. */
  queryFn: (params: DataGridQueryParams) => Promise<PagedResponse<T>>;
  /** Default page size. @default 20 */
  defaultPageSize?: number;
  /** Default sorts to apply on mount (overridden by URL). */
  defaultSorts?: SortDescriptor[];
  /** Auto-refresh interval in ms. Pass 0 or undefined to disable. */
  refetchInterval?: number;
  /** Whether to sync state with URLSearchParams. @default true */
  syncUrl?: boolean;
  /** Debounce delay for search in ms. @default 300 */
  searchDebounceMs?: number;
  /** TanStack Query enabled flag. @default true */
  enabled?: boolean;
}

export interface UseDataGridQueryResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  sorts: SortDescriptor[];
  filters: Record<string, FilterValue>;
  search: string;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onSortChange: (sorts: SortDescriptor[]) => void;
  onFilterChange: (filters: Record<string, FilterValue>) => void;
  onRefresh: () => void;
  setSearch: (value: string) => void;
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

function sortsToParam(sorts: SortDescriptor[]): string | null {
  if (sorts.length === 0) return null;
  return sorts.map((s) => `${s.field}:${s.direction}`).join(',');
}

function paramToSorts(param: string | null): SortDescriptor[] | null {
  if (!param) return null;
  return param.split(',').map((part) => {
    const [field, dir] = part.split(':');
    return { field, direction: (dir === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc' };
  });
}

function filtersToParam(filters: Record<string, FilterValue>): string | null {
  const entries = Object.entries(filters);
  if (entries.length === 0) return null;
  return JSON.stringify(filters);
}

function paramToFilters(param: string | null): Record<string, FilterValue> | null {
  if (!param) return null;
  try {
    return JSON.parse(param);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDataGridQuery<T>(
  options: UseDataGridQueryOptions<T>,
): UseDataGridQueryResult<T> {
  const {
    queryKey,
    queryFn,
    defaultPageSize = 20,
    defaultSorts = [],
    refetchInterval,
    syncUrl = true,
    searchDebounceMs = 300,
    enabled = true,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Initialize state from URL or defaults ---
  const [page, setPage] = useState(() => {
    if (syncUrl) {
      const p = searchParams.get('page');
      if (p) return Math.max(1, parseInt(p, 10) || 1);
    }
    return 1;
  });

  const [pageSize, setPageSize] = useState(() => {
    if (syncUrl) {
      const ps = searchParams.get('pageSize');
      if (ps) return parseInt(ps, 10) || defaultPageSize;
    }
    return defaultPageSize;
  });

  const [sorts, setSorts] = useState<SortDescriptor[]>(() => {
    if (syncUrl) {
      const fromUrl = paramToSorts(searchParams.get('sort'));
      if (fromUrl) return fromUrl;
    }
    return defaultSorts;
  });

  const [filters, setFilters] = useState<Record<string, FilterValue>>(() => {
    if (syncUrl) {
      const fromUrl = paramToFilters(searchParams.get('filters'));
      if (fromUrl) return fromUrl;
    }
    return {};
  });

  const [searchInput, setSearchInput] = useState(() => {
    if (syncUrl) return searchParams.get('q') ?? '';
    return '';
  });

  const [debouncedSearch, setDebouncedSearch] = useState(searchInput);

  // --- Debounce search ---
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchInput);
      // Reset to page 1 on search change
      setPage(1);
    }, searchDebounceMs);
    return () => clearTimeout(debounceRef.current);
  }, [searchInput, searchDebounceMs]);

  // --- Sync to URL ---
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (!syncUrl) return;
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (page > 1) params.set('page', String(page));
    if (pageSize !== defaultPageSize) params.set('pageSize', String(pageSize));
    const sortParam = sortsToParam(sorts);
    if (sortParam) params.set('sort', sortParam);
    const filterParam = filtersToParam(filters);
    if (filterParam) params.set('filters', filterParam);
    if (debouncedSearch) params.set('q', debouncedSearch);

    const qs = params.toString();
    const newUrl = qs ? `${pathname}?${qs}` : pathname;
    router.replace(newUrl, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, sorts, filters, debouncedSearch, syncUrl]);

  // --- Build query params ---
  const gridParams = useMemo<DataGridQueryParams>(
    () => ({
      page,
      pageSize,
      sort: sorts,
      filters,
      search: debouncedSearch,
    }),
    [page, pageSize, sorts, filters, debouncedSearch],
  );

  // --- TanStack Query ---
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [...queryKey, gridParams],
    queryFn: () => queryFn(gridParams),
    placeholderData: keepPreviousData,
    refetchInterval: refetchInterval || undefined,
    enabled,
  });

  // --- Callbacks ---
  const onPageChange = useCallback((p: number) => setPage(p), []);
  const onPageSizeChange = useCallback((ps: number) => {
    setPageSize(ps);
    setPage(1);
  }, []);

  const onSortChange = useCallback((s: SortDescriptor[]) => {
    setSorts(s);
    setPage(1);
  }, []);

  const onFilterChange = useCallback((f: Record<string, FilterValue>) => {
    setFilters(f);
    setPage(1);
  }, []);

  const onRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    data: data?.items ?? [],
    totalCount: data?.totalCount ?? 0,
    page,
    pageSize,
    sorts,
    filters,
    search: searchInput,
    isLoading,
    isFetching,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    onPageChange,
    onPageSizeChange,
    onSortChange,
    onFilterChange,
    onRefresh,
    setSearch: setSearchInput,
  };
}
