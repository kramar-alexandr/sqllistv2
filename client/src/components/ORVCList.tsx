import { useState, useMemo, useCallback } from 'react';
import FilterPanel from './FilterPanel';
import VirtualTable from './VirtualTable';
import OrderModal from './OrderModal';
import { filterKey } from '../hooks/useORVCList';
import type { FilterMode, ORVCFilters, ORVCRow } from '../types/orvc';

// Maps UI filter mode to SQL filter expression (mirrors list-2.html filterModes)
const FILTER_EXPR: Record<FilterMode, string> = {
  main:            'CLOSED==0 and CUSTOMSTATUSFLAG<>9 and CUSTOMSTATUSFLAG<>10',
  all:             '',
  new:             'CLOSED==0 and CUSTOMSTATUSFLAG==0',
  open:            'CLOSED==0 and CUSTOMSTATUSFLAG==1',
  confirmed:       'CLOSED==0 and CUSTOMSTATUSFLAG==2',
  nocall:          'CLOSED==0 and CUSTOMSTATUSFLAG==3',
  changed:         'CLOSED==0 and CUSTOMSTATUSFLAG==4',
  vsborke:         'CLOSED==0 and CUSTOMSTATUSFLAG==5',
  sobran:          'CLOSED==0 and CUSTOMSTATUSFLAG==6',
  otpravlen:       'CLOSED==0 and CUSTOMSTATUSFLAG==7',
  dostavlen:       'CLOSED==0 and CUSTOMSTATUSFLAG==8',
  complete:        'CLOSED==0 and CUSTOMSTATUSFLAG==9',
  canceled:        'CLOSED==0 and CUSTOMSTATUSFLAG==10',
  pending_payment: 'CLOSED==0 and CUSTOMSTATUSFLAG==11',
  pending_stock:   'CLOSED==0 and CUSTOMSTATUSFLAG==12',
  no_stock:        'CLOSED==0 and CUSTOMSTATUSFLAG==13',
  approved:        'CLOSED==0 and CUSTOMSTATUSFLAG==14',
  sorting:         'CLOSED==0 and SHVC_filtered.SORTING==`ОТГРУЖЕНО`',
};

interface Props {
  compno: string;
  salesman: string;
  salesgroup: string;
  user: string;
  searchstr: string;
}

export default function ORVCList({ compno, salesman, salesgroup, user, searchstr }: Props) {
  const [filterMode, setFilterMode] = useState<FilterMode>('main');
  const [ownOnly, setOwnOnly] = useState(false);
  const [modalSernr, setModalSernr] = useState<number | null>(null);

  const filters: ORVCFilters = useMemo(() => {
    const f: ORVCFilters = {};
    if (compno) f.compno = compno;
    if (salesgroup) f.salesgroup = salesgroup;
    if (salesman) f.salesman = salesman;
    if (ownOnly && user) f.ownsalesman = user;
    if (searchstr) f.searchstr = searchstr;

    const expr = FILTER_EXPR[filterMode];
    if (expr) f.filter = expr;

    return f;
  }, [compno, salesgroup, salesman, ownOnly, user, searchstr, filterMode]);

  const fKey = useMemo(() => filterKey(filters), [filters]);

  const handleModeChange = useCallback((mode: FilterMode) => {
    setFilterMode(mode);
  }, []);

  const handleOwnOnly = useCallback((v: boolean) => {
    setOwnOnly(v);
  }, []);

  const handleRowClick = useCallback((_row: ORVCRow) => {
    // row click — selection is handled inside VirtualTable
  }, []);

  const handleInfoClick = useCallback((sernr: number) => {
    setModalSernr(sernr);
  }, []);

  return (
    <div className="orvc-list">
      <FilterPanel
        mode={filterMode}
        ownOnly={ownOnly}
        onModeChange={handleModeChange}
        onOwnOnlyChange={handleOwnOnly}
      />
      <VirtualTable
        filters={filters}
        filterKey={fKey}
        user={user}
        onRowClick={handleRowClick}
        onInfoClick={handleInfoClick}
      />
      <OrderModal
        sernr={modalSernr}
        compno={compno || 1}
        onClose={() => setModalSernr(null)}
      />
    </div>
  );
}
