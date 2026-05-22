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

export function openInERP(erpUrl: string, sernr: number | string, user: string, wclass: string) {
  if (!erpUrl) return;
  const url = `${erpUrl}/WebOpenDCLassForUser.hal` +
    `?user=${encodeURIComponent(user)}` +
    `&sernr=${encodeURIComponent(sernr)}` +
    `&wclass=${encodeURIComponent(wclass)}`;
  window.open(url, '_blank');
}
