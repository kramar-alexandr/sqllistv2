import { useMemo } from 'react';
import { useQuery, useQueries, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchCount, fetchRows } from '../api/orvc';
import type { ORVCFilters, ORVCRow } from '../types/orvc';

export const PAGE_SIZE = 50;
const STALE_TIME = 8_000;   // page data considered fresh for 8s
const REFETCH_MS = 10_000;  // background refetch every 10s

export function filterKey(filters: ORVCFilters): string {
  return JSON.stringify(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

// Returns stable query keys for a set of page indices
function pageQueryKey(pageIndex: number, fKey: string, orderBy: string, order: string) {
  return ['orvc', 'page', pageIndex, fKey, orderBy, order] as const;
}

interface UseORVCListResult {
  total: number;
  isCountLoading: boolean;
  isCountFetching: boolean;
  getRow: (index: number) => ORVCRow | undefined;
  isPageLoading: (pageIndex: number) => boolean;
  prefetchPages: (pageIndices: number[]) => void;
  invalidateAll: () => void;
}

export function useORVCList(
  filters: ORVCFilters,
  visiblePageIndices: number[],
  orderBy = 'SERNR',
  order: 'asc' | 'desc' = 'desc'
): UseORVCListResult {
  const queryClient = useQueryClient();
  const fKey = useMemo(() => filterKey(filters), [filters]);

  // ── COUNT ────────────────────────────────────────────────────────────────
  const countQuery = useQuery({
    queryKey: ['orvc', 'count', fKey],
    queryFn: () => fetchCount(filters),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_MS,
    placeholderData: keepPreviousData,
  });

  // ── VISIBLE PAGES ────────────────────────────────────────────────────────
  const pageQueries = useQueries({
    queries: visiblePageIndices.map(pageIndex => ({
      queryKey: pageQueryKey(pageIndex, fKey, orderBy, order),
      queryFn: () => fetchRows(filters, pageIndex * PAGE_SIZE, PAGE_SIZE, orderBy, order),
      staleTime: STALE_TIME,
      refetchInterval: REFETCH_MS,
      placeholderData: keepPreviousData,
    })),
  });

  // ── ROW LOOKUP MAP ───────────────────────────────────────────────────────
  // Map from absolute row index → row data
  const rowMap = useMemo(() => {
    const map = new Map<number, ORVCRow>();
    pageQueries.forEach((q, i) => {
      if (!q.data?.data) return;
      const pageIndex = visiblePageIndices[i];
      q.data.data.forEach((row, j) => {
        map.set(pageIndex * PAGE_SIZE + j, row);
      });
    });
    return map;
  }, [pageQueries, visiblePageIndices]);

  const loadingPageSet = useMemo(() => {
    const set = new Set<number>();
    pageQueries.forEach((q, i) => {
      if (q.isLoading) set.add(visiblePageIndices[i]);
    });
    return set;
  }, [pageQueries, visiblePageIndices]);

  // ── PREFETCH ─────────────────────────────────────────────────────────────
  function prefetchPages(indices: number[]) {
    for (const pageIndex of indices) {
      queryClient.prefetchQuery({
        queryKey: pageQueryKey(pageIndex, fKey, orderBy, order),
        queryFn: () => fetchRows(filters, pageIndex * PAGE_SIZE, PAGE_SIZE, orderBy, order),
        staleTime: STALE_TIME,
      });
    }
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['orvc'] });
  }

  return {
    total: countQuery.data?.total ?? 0,
    isCountLoading: countQuery.isLoading,
    isCountFetching: countQuery.isFetching,
    getRow: (index: number) => rowMap.get(index),
    isPageLoading: (pageIndex: number) => loadingPageSet.has(pageIndex),
    prefetchPages,
    invalidateAll,
  };
}
