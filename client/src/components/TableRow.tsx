import type { ORVCRow } from '../types/orvc';

// Row height must match ROW_HEIGHT in VirtualTable
export const ROW_HEIGHT = 22;

const STATUS_CLASS: Record<number, string> = {
  1: 'row-red', 3: 'row-red', 4: 'row-red', 12: 'row-red', 13: 'row-red',
  2: 'row-yellow',
  5: 'row-green', 6: 'row-green', 7: 'row-green', 8: 'row-green', 11: 'row-green',
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return '';
  const [y, m, d] = v.split('-');
  return `${d}/${m}/${y}`;
}

function fmtSum(v: number | null | undefined): string {
  if (v == null) return '';
  return Number(v).toLocaleString('uk-UA', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

interface Props {
  row: ORVCRow;
  selected: boolean;
  onClick: (row: ORVCRow) => void;
  onInfoClick: (sernr: number) => void;
}

export default function TableRow({ row, selected, onClick, onInfoClick }: Props) {
  const flag = Number(row.CUSTOMSTATUSFLAG);
  const statusCls = selected ? 'row-selected' : (STATUS_CLASS[flag] ?? '');

  return (
    <div
      className={`trow ${statusCls}`}
      style={{ height: ROW_HEIGHT }}
      onClick={() => onClick(row)}
    >
      <div className="tc tc-info">
        <button
          className="info-btn"
          onClick={e => { e.stopPropagation(); onInfoClick(row.SERNR); }}
          title="Детали заказа"
        >ℹ</button>
      </div>
      <div className="tc tc-sernr">{row.SERNR}</div>
      <div className="tc tc-mark">{row.OKFLAG}</div>
      <div className="tc tc-mark">{row.SHIPMARK}</div>
      <div className="tc tc-mark">{row.INVMARK}</div>
      <div className="tc tc-date">{fmtDate(row.ORDDATE)}</div>
      <div className="tc tc-location">{row.LOCATION}</div>
      <div className="tc tc-custordnr">{row.CUSTORDNR}</div>
      <div className="tc tc-custcode">{row.CUSTCODE}</div>
      <div className="tc tc-addr">{row.ADDR0}</div>
      <div className="tc tc-officialsernr">{row.OFFICIALSERNR}</div>
      <div className="tc tc-date">{fmtDate(row.LASTSHIPDATE)}</div>
      <div className="tc tc-orderclass">{row.ORDERCLASS}</div>
      <div className="tc tc-sum">{fmtSum(row.SUM4)}</div>
      <div className="tc tc-status">{row.CUSTOMSTATUSFLAGTEXT}</div>
      <div className="tc tc-sorting">{row.SORTING}</div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="trow trow-skeleton" style={{ height: ROW_HEIGHT }}>
      <div className="skeleton-line" />
    </div>
  );
}
