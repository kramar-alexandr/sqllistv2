import type { CountResponse, OrderDetailResponse, ORVCFilters, RowsResponse, SyncResponse } from '../types/orvc';

const BASE = '/api/v2/orvc';

function toParams(obj: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  return p.toString();
}

export async function fetchCount(filters: ORVCFilters): Promise<CountResponse> {
  const qs = toParams(filters as Record<string, string>);
  const res = await fetch(`${BASE}/count${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`count failed: ${res.status}`);
  return res.json();
}

export async function fetchRows(
  filters: ORVCFilters,
  offset: number,
  limit: number,
  orderBy = 'SERNR',
  order: 'asc' | 'desc' = 'desc'
): Promise<RowsResponse> {
  const qs = toParams({ ...filters, offset, limit, orderBy, order } as Record<string, string | number>);
  const res = await fetch(`${BASE}/rows?${qs}`);
  if (!res.ok) throw new Error(`rows failed: ${res.status}`);
  return res.json();
}

export async function fetchSync(filters: ORVCFilters): Promise<SyncResponse> {
  const qs = toParams(filters as Record<string, string>);
  const res = await fetch(`${BASE}/sync${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`sync failed: ${res.status}`);
  return res.json();
}

export async function fetchOrderDetail(sernr: number | string, compno: string | number): Promise<OrderDetailResponse> {
  const res = await fetch(`${BASE}/order?sernr=${sernr}&compno=${compno}`);
  if (!res.ok) throw new Error(`order detail failed: ${res.status}`);
  return res.json();
}
