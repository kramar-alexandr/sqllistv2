export interface IVVCRow {
  SERNR: number;
  OKFLAG: string;       // '✓' | ''
  INVDATE: string;
  OFFICIALSERNR: string;
  ORDERNR: number | null;
  CUSTCODE: string;
  ADDR0: string;
  SUM4: number | null;
  CREDMARK: string;     // 'CR' | ''
  CURNCYCODE: string;
  INVALID: string;      // '!' | ''
  SALESMAN: string;
  rowColor: 'red' | 'yellow' | 'green' | '';
  compno: number;
}

export interface IVVCFilters {
  compno?: string;
  salesman?: string;
  salesgroup?: string;
  filter?: string;
  searchstr?: string;
}
