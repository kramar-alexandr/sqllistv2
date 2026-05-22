import type { IVVCFilters, IVVCRow } from '../types/ivvc';

const BASE = '/api/v2/ivvc';

function toParams(obj: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  return p.toString();
}

export async function fetchIVVCCount(filters: IVVCFilters): Promise<{ total: number }> {
  const qs = toParams(filters as Record<string, string>);
  const res = await fetch(`${BASE}/count${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`ivvc/count failed: ${res.status}`);
  return res.json();
}

export async function fetchIVVCRows(
  filters: IVVCFilters,
  offset: number,
  limit: number,
  orderBy = 'SERNR',
  order: 'asc' | 'desc' = 'desc'
): Promise<{ data: IVVCRow[]; offset: number; limit: number }> {
  const qs = toParams({ ...filters, offset, limit, orderBy, order } as Record<string, string | number>);
  const res = await fetch(`${BASE}/rows?${qs}`);
  if (!res.ok) throw new Error(`ivvc/rows failed: ${res.status}`);
  return res.json();
}

export async function fetchIVVCSync(filters: IVVCFilters): Promise<{ total: number; topIds: number[] }> {
  const qs = toParams(filters as Record<string, string>);
  const res = await fetch(`${BASE}/sync${qs ? '?' + qs : ''}`);
  if (!res.ok) throw new Error(`ivvc/sync failed: ${res.status}`);
  return res.json();
}
