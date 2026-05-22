import { useMemo } from 'react';
import { useQuery, useQueries, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { fetchIVVCCount, fetchIVVCRows } from '../api/ivvc';
import type { IVVCFilters, IVVCRow } from '../types/ivvc';

export const IVVC_PAGE_SIZE = 50;
const STALE_TIME = 8_000;
const REFETCH_MS = 10_000;

export function ivvcFilterKey(filters: IVVCFilters): string {
  return JSON.stringify(
    Object.entries(filters)
      .filter(([, v]) => v !== undefined && v !== '')
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

export function useIVVCList(
  filters: IVVCFilters,
  visiblePageIndices: number[],
  orderBy = 'SERNR',
  order: 'asc' | 'desc' = 'desc'
) {
  const queryClient = useQueryClient();
  const fKey = useMemo(() => ivvcFilterKey(filters), [filters]);

  const countQuery = useQuery({
    queryKey: ['ivvc', 'count', fKey],
    queryFn: () => fetchIVVCCount(filters),
    staleTime: STALE_TIME,
    refetchInterval: REFETCH_MS,
    placeholderData: keepPreviousData,
  });

  const pageQueries = useQueries({
    queries: visiblePageIndices.map(pageIndex => ({
      queryKey: ['ivvc', 'page', pageIndex, fKey, orderBy, order],
      queryFn: () => fetchIVVCRows(filters, pageIndex * IVVC_PAGE_SIZE, IVVC_PAGE_SIZE, orderBy, order),
      staleTime: STALE_TIME,
      refetchInterval: REFETCH_MS,
      placeholderData: keepPreviousData,
    })),
  });

  const rowMap = useMemo(() => {
    const map = new Map<number, IVVCRow>();
    pageQueries.forEach((q, i) => {
      if (!q.data?.data) return;
      const pageIndex = visiblePageIndices[i];
      q.data.data.forEach((row, j) => {
        map.set(pageIndex * IVVC_PAGE_SIZE + j, row);
      });
    });
    return map;
  }, [pageQueries, visiblePageIndices]);

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['ivvc'] });
  }

  return {
    total: countQuery.data?.total ?? 0,
    isCountFetching: countQuery.isFetching,
    getRow: (index: number) => rowMap.get(index),
    invalidateAll,
  };
}
