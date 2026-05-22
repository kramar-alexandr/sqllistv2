import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useORVCList, PAGE_SIZE } from '../hooks/useORVCList';
import { useLiveSync } from '../hooks/useLiveSync';
import TableRow, { SkeletonRow, ROW_HEIGHT } from './TableRow';
import type { ORVCFilters, ORVCRow } from '../types/orvc';

const OVERSCAN = 8;
const PREFETCH_AHEAD = 1; // pages to prefetch beyond visible

interface Column {
  label: string;
  cls: string;
  width: number;
  sortField?: string;
}

const COLUMNS: Column[] = [
  { label: '', cls: 'tc-info', width: 28 },
  { label: '№', cls: 'tc-sernr', width: 62, sortField: 'SERNR' },
  { label: 'ОК', cls: 'tc-mark', width: 28 },
  { label: 'Отг.', cls: 'tc-mark', width: 28 },
  { label: 'Сч.', cls: 'tc-mark', width: 28 },
  { label: 'Дата', cls: 'tc-date', width: 76, sortField: 'ORDDATE' },
  { label: 'Склад', cls: 'tc-location', width: 78 },
  { label: '№ зак. кл.', cls: 'tc-custordnr', width: 100 },
  { label: 'Клиент', cls: 'tc-custcode', width: 96, sortField: 'CUSTCODE' },
  { label: 'Имя', cls: 'tc-addr', width: 220, sortField: 'ADDR0' },
  { label: 'Оф.сер.', cls: 'tc-officialsernr', width: 116 },
  { label: 'Дата отгр.', cls: 'tc-date', width: 84, sortField: 'LASTSHIPDATE' },
  { label: 'Вид', cls: 'tc-orderclass', width: 58 },
  { label: 'Итого', cls: 'tc-sum', width: 80, sortField: 'SUM4' },
  { label: 'Статус', cls: 'tc-status', width: 120, sortField: 'CUSTOMSTATUSFLAG' },
  { label: 'Отгр.', cls: 'tc-sorting', width: 44 },
];

interface Props {
  filters: ORVCFilters;
  filterKey: string;
  onRowClick: (row: ORVCRow) => void;
  onInfoClick: (sernr: number) => void;
}

interface Sort {
  by: string;
  dir: 'asc' | 'desc';
}

export default function VirtualTable({ filters, filterKey, onRowClick, onInfoClick }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedSernr, setSelectedSernr] = useState<number | null>(null);
  const [sort, setSort] = useState<Sort>({ by: 'SERNR', dir: 'desc' });

  // Track which virtual pages are currently in view
  const [visiblePageIndices, setVisiblePageIndices] = useState<number[]>([0]);

  const { total, isCountFetching, getRow, isPageLoading, prefetchPages, invalidateAll } =
    useORVCList(filters, visiblePageIndices, sort.by, sort.dir);

  // Background sync — updates count and invalidates page 0 on top-id change
  useLiveSync(filters);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Derive visible page indices from virtual items
  useEffect(() => {
    if (virtualItems.length === 0) return;

    const pages = new Set<number>();
    for (const item of virtualItems) {
      const p = Math.floor(item.index / PAGE_SIZE);
      pages.add(p);
    }

    // Add prefetch pages
    const maxPage = Math.max(...pages);
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const nextPage = maxPage + i;
      const maxPossiblePage = Math.floor((total - 1) / PAGE_SIZE);
      if (nextPage <= maxPossiblePage) pages.add(nextPage);
    }

    const arr = Array.from(pages).sort((a, b) => a - b);
    setVisiblePageIndices(prev => {
      // Avoid state update if nothing changed
      if (prev.length === arr.length && prev.every((v, i) => v === arr[i])) return prev;
      return arr;
    });
  }, [virtualItems, total]);

  // Prefetch adjacent pages when approaching edges
  useEffect(() => {
    if (visiblePageIndices.length === 0) return;
    const maxVisible = Math.max(...visiblePageIndices);
    const nextBatch = [maxVisible + 1, maxVisible + 2].filter(
      p => p <= Math.floor((total - 1) / PAGE_SIZE)
    );
    if (nextBatch.length) prefetchPages(nextBatch);
  }, [visiblePageIndices, total]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRowClick = useCallback((row: ORVCRow) => {
    setSelectedSernr(row.SERNR);
    onRowClick(row);
  }, [onRowClick]);

  const handleSortClick = useCallback((field: string) => {
    setSort(prev =>
      prev.by === field
        ? { by: field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { by: field, dir: 'desc' }
    );
  }, []);

  // Scroll to top when sort or filter changes
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
    setVisiblePageIndices([0]);
  }, [sort, filterKey]);

  // Reset selection when filters change
  useEffect(() => {
    setSelectedSernr(null);
  }, [filterKey]);

  const totalSize = virtualizer.getTotalSize();

  return (
    <div className="vtable-wrapper">
      {/* Header */}
      <div className="vtable-header">
        <div className="vtable-header-inner">
          {COLUMNS.map((col, i) => (
            <div
              key={i}
              className={`th ${col.cls}${col.sortField ? ' th-sortable' : ''}${sort.by === col.sortField ? ' th-active' : ''}`}
              style={{ width: col.width, minWidth: col.width }}
              onClick={col.sortField ? () => handleSortClick(col.sortField!) : undefined}
            >
              {col.label}
              {col.sortField && sort.by === col.sortField && (
                <span className="th-sort-arrow">{sort.dir === 'desc' ? '↓' : '↑'}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Status bar */}
      <div className="vtable-statusbar">
        <span className={`sync-dot${isCountFetching ? ' syncing' : ''}`} title="Live sync" />
        <span>{total.toLocaleString('uk-UA')} записей</span>
        <button className="refresh-btn" onClick={invalidateAll} title="Обновить все">↺</button>
      </div>

      {/* Scrollable body — absolute positioning approach for fixed-height rows */}
      <div ref={parentRef} className="vtable-scroll">
        <div style={{ height: totalSize, width: '100%', position: 'relative' }}>
          {virtualItems.map(virtualItem => {
            const row = getRow(virtualItem.index);
            const pageIndex = Math.floor(virtualItem.index / PAGE_SIZE);

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                {row ? (
                  <TableRow
                    row={row}
                    selected={row.SERNR === selectedSernr}
                    onClick={handleRowClick}
                    onInfoClick={onInfoClick}
                  />
                ) : (
                  <SkeletonRow key={`sk-${virtualItem.index}-${pageIndex}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
