import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { fetchSync } from '../api/orvc';
import { filterKey } from './useORVCList';
import type { ORVCFilters } from '../types/orvc';

const SYNC_INTERVAL = 5_000;

// Detects meaningful changes between two topId arrays
function topIdsChanged(prev: number[], next: number[]): boolean {
  if (prev.length !== next.length) return true;
  for (let i = 0; i < Math.min(prev.length, next.length, 20); i++) {
    if (prev[i] !== next[i]) return true;
  }
  return false;
}

export function useLiveSync(filters: ORVCFilters) {
  const queryClient = useQueryClient();
  const prevTopIdsRef = useRef<number[]>([]);
  const prevTotalRef = useRef<number>(-1);

  useEffect(() => {
    let cancelled = false;

    async function sync() {
      if (cancelled) return;
      try {
        const result = await fetchSync(filters);
        if (cancelled) return;

        const fKey = filterKey(filters);

        // Total changed → update count cache so virtual scroll height adjusts immediately
        if (result.total !== prevTotalRef.current) {
          prevTotalRef.current = result.total;
          queryClient.setQueryData(['orvc', 'count', fKey], { total: result.total });
        }

        // Top IDs changed → new records appeared or top records were deleted
        // Invalidate page 0 so it re-fetches with fresh first rows
        if (topIdsChanged(prevTopIdsRef.current, result.topIds)) {
          prevTopIdsRef.current = result.topIds;
          queryClient.invalidateQueries({ queryKey: ['orvc', 'page', 0, fKey] });
        }
      } catch {
        // silently ignore network errors on background sync
      }
    }

    const timer = setInterval(sync, SYNC_INTERVAL);
    // Run immediately on first mount / filter change
    sync();

    return () => {
      cancelled = true;
      clearInterval(timer);
      prevTopIdsRef.current = [];
      prevTotalRef.current = -1;
    };
  }, [filters, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
}
