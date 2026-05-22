import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useERPUrl, openInERP } from '../hooks/useERPUrl';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useIVVCList, IVVC_PAGE_SIZE } from '../hooks/useIVVCList';
import type { IVVCRow, IVVCFilters } from '../types/ivvc';

const ROW_HEIGHT = 22;
const OVERSCAN = 8;

interface Col {
  label: string;
  width: number;
  sortField?: string;
  align?: 'right' | 'center';
  render: (row: IVVCRow) => string | number | null | undefined;
}

// Column layout mirrors IVLClass HAL window (positions → pixel widths):
//   4→79(75)  79→111(32)  111→191(80)  191→301(110)  301→381(80)
//   381→~451(70)  451→right(-130)  -130→-60(70)  -60→-1(59)  -1(20)
const COLUMNS: Col[] = [
  {
    label: 'Číslo',   width: 75,  sortField: 'SERNR',
    render: r => r.SERNR,
  },
  {
    label: 'Zápis',   width: 32,  sortField: 'OKFLAG', align: 'center',
    render: r => r.OKFLAG,
  },
  {
    label: 'Dátum',   width: 80,  sortField: 'INVDATE',
    render: r => r.INVDATE,
  },
  {
    label: 'Úrad.č.', width: 110, sortField: 'OFFICIALSERNR',
    render: r => r.OFFICIALSERNR,
  },
  {
    label: 'Č.Obj.',  width: 80,  sortField: 'ORDERNR',
    render: r => r.ORDERNR ?? '',
  },
  {
    label: 'Odberateľ', width: 70, sortField: 'CUSTCODE',
    render: r => r.CUSTCODE,
  },
  {
    label: 'Názov',   width: 220, sortField: 'ADDR0',
    render: r => r.ADDR0,
  },
  {
    label: 'Celkom',  width: 90,  sortField: 'SUM4', align: 'right',
    render: r => r.SUM4 != null
      ? Number(r.SUM4).toLocaleString('sk-SK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '',
  },
  {
    label: '',        width: 36,  align: 'center',
    render: r => r.CREDMARK,  // 'CR' | ''
  },
  {
    label: 'Mena',    width: 52,  sortField: 'CURNCYCODE', align: 'center',
    render: r => r.CURNCYCODE,
  },
  {
    label: '',        width: 20,  align: 'center',
    render: r => r.INVALID,  // '!' | ''
  },
];

const TOTAL_WIDTH = COLUMNS.reduce((s, c) => s + c.width, 0);

interface Props {
  compno: string;
  salesman: string;
  salesgroup: string;
  user: string;
}

export default function IVVCList({ compno, salesman, salesgroup, user }: Props) {
  const erpUrl = useERPUrl();
  const parentRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState({ by: 'SERNR', dir: 'desc' as 'asc' | 'desc' });
  const [visiblePageIndices, setVisiblePageIndices] = useState<number[]>([0]);
  const [selectedSernr, setSelectedSernr] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const filters: IVVCFilters = useMemo(() => {
    const f: IVVCFilters = {};
    if (compno)    f.compno    = compno;
    if (salesman)  f.salesman  = salesman;
    if (salesgroup) f.salesgroup = salesgroup;
    if (debouncedSearch) f.searchstr = debouncedSearch;
    return f;
  }, [compno, salesman, salesgroup, debouncedSearch]);

  const { total, isCountFetching, getRow, invalidateAll } =
    useIVVCList(filters, visiblePageIndices, sort.by, sort.dir);

  const virtualizer = useVirtualizer({
    count: total,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (virtualItems.length === 0) return;
    const pages = new Set(virtualItems.map(item => Math.floor(item.index / IVVC_PAGE_SIZE)));
    const arr = Array.from(pages).sort((a, b) => a - b);
    setVisiblePageIndices(prev =>
      prev.length === arr.length && prev.every((v, i) => v === arr[i]) ? prev : arr
    );
  }, [virtualItems]);

  // Reset scroll + selection on filter/sort change
  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
    setVisiblePageIndices([0]);
    setSelectedSernr(null);
  }, [sort, filters]);

  const handleSort = useCallback((field: string) => {
    setSort(prev =>
      prev.by === field
        ? { by: field, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { by: field, dir: 'desc' }
    );
  }, []);

  return (
    <div className="orvc-list">

      {/* ── Toolbar ── */}
      <div className="filter-panel">
        <div className="filter-row">
          <input
            type="search"
            placeholder="Hľadať..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '2px 6px', fontSize: 11, border: '1px solid #ccc', borderRadius: 3, width: 200 }}
          />
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#666' }}>
            {total.toLocaleString('sk-SK')} záznamov
          </span>
          <button className="refresh-btn" onClick={invalidateAll} title="Obnoviť">↺</button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="vtable-wrapper">

        {/* Header */}
        <div className="vtable-header">
          <div className="vtable-header-inner" style={{ width: TOTAL_WIDTH }}>
            {COLUMNS.map((col, i) => (
              <div
                key={i}
                className={`th${col.sortField ? ' th-sortable' : ''}${sort.by === col.sortField ? ' th-active' : ''}`}
                style={{
                  width: col.width, minWidth: col.width,
                  textAlign: col.align ?? 'left',
                }}
                onClick={col.sortField ? () => handleSort(col.sortField!) : undefined}
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
          <span>Faktúry (IVVC)</span>
        </div>

        {/* Scrollable body */}
        <div ref={parentRef} className="vtable-scroll">
          <div style={{ height: virtualizer.getTotalSize(), width: TOTAL_WIDTH, position: 'relative' }}>
            {virtualItems.map(vItem => {
              const row = getRow(vItem.index);
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: 'absolute',
                    top: 0, left: 0,
                    width: '100%', height: ROW_HEIGHT,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  {row ? (
                    <IVVCRowEl
                      row={row}
                      selected={row.SERNR === selectedSernr}
                      onClick={setSelectedSernr}
                      onDblClick={sernr => openInERP(erpUrl, sernr, user, 'IVDClass')}
                    />
                  ) : (
                    <div className="trow trow-skeleton" style={{ height: ROW_HEIGHT }}>
                      <div className="skeleton-line" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function rowClass(row: IVVCRow): string {
  const colorMap: Record<string, string> = {
    red: 'row-red',
    yellow: 'row-yellow',
    green: 'row-green',
  };
  const color = colorMap[row.rowColor] ?? '';
  return color ? `trow ${color}` : 'trow';
}

function IVVCRowEl({ row, selected, onClick, onDblClick }: {
  row: IVVCRow;
  selected: boolean;
  onClick: (sernr: number) => void;
  onDblClick: (sernr: number) => void;
}) {
  const cls = `${rowClass(row)}${selected ? ' row-selected' : ''}`;
  return (
    <div
      className={cls}
      style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center' }}
      onClick={() => onClick(row.SERNR)}
      onDoubleClick={() => onDblClick(row.SERNR)}
    >
      {COLUMNS.map((col, i) => {
        const val = col.render(row);
        const isOkFlag = col.label === 'Zápis';
        return (
          <div
            key={i}
            className="tc"
            style={{
              width: col.width, minWidth: col.width,
              textAlign: col.align ?? 'left',
              color: isOkFlag && val === '✓' ? '#28a745' : undefined,
              fontWeight: isOkFlag ? 600 : undefined,
            }}
          >
            {val}
          </div>
        );
      })}
    </div>
  );
}
