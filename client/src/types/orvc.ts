export interface ORVCRow {
  SERNR: number;
  OKFLAG: string;
  SHIPMARK: string;
  INVMARK: string;
  ORDDATE: string;
  LOCATION: string;
  CUSTORDNR: string;
  CUSTCODE: string;
  ADDR0: string;
  OFFICIALSERNR: string;
  LASTSHIPDATE: string;
  ORDERCLASS: string;
  SUM4: number | null;
  CUSTOMSTATUSFLAGTEXT: string;
  CUSTOMSTATUSFLAG: number;
  FEEDBACKSTATUS: number | null;
  WAITINGFORITEMSDATE: string | null;
  WAITINGFORITEMSTIME: string | null;
  TRANSPORTNUMBER: string;
  PHONE: string;
  NPPHONE: string;
  rdbCOMMENT: string;
  SALESMAN: string;
  COMMENT2: string;
  COMMENT3: string;
  COMMENT4: string;
  SORTING: string | null;
}

export type FilterMode =
  | 'main' | 'all' | 'new' | 'open' | 'confirmed' | 'nocall'
  | 'changed' | 'vsborke' | 'sobran' | 'otpravlen' | 'dostavlen'
  | 'complete' | 'canceled' | 'pending_payment' | 'pending_stock'
  | 'no_stock' | 'approved' | 'sorting';

export interface ORVCFilters {
  compno?: string;
  salesgroup?: string;
  salesman?: string;
  ownsalesman?: string;
  filter?: string;
  searchstr?: string;
}

export interface RowsResponse {
  data: ORVCRow[];
  offset: number;
  limit: number;
}

export interface CountResponse {
  total: number;
}

export interface SyncResponse {
  total: number;
  topIds: number[];
}

export interface OrderDetailResponse {
  sernr: string;
  compno: number | string;
  order: Record<string, unknown> | null;
  shipments: Record<string, unknown>[];
}
