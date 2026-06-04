import { useQuery } from '@tanstack/react-query';

async function fetchConfig(): Promise<{ erpUrl: string }> {
  const res = await fetch('/api/config');
  if (!res.ok) return { erpUrl: '' };
  return res.json();
}

export function useERPUrl(): string {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data?.erpUrl ?? '';
}

// Calls server-side proxy /api/erp/open — server reaches ERP over local network
export function openInERP(_erpUrl: string, sernr: number | string, user: string, wclass: string) {
  const params = new URLSearchParams({
    user: String(user),
    sernr: String(sernr),
    wclass,
  });
  fetch(`/api/erp/open?${params}`).catch(() => {});
}
