import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchGmudActiveClients,
  fetchGmudClientImpact,
  type GmudActiveClient,
} from '@/features/gmud/api/gmudClients'

export function useGmudClientImpact(protocol: number, enabled = true) {
  return useQuery({
    queryKey: ['gmud', 'client-impact', protocol],
    queryFn: () => fetchGmudClientImpact(protocol),
    enabled: enabled && Number.isFinite(protocol) && protocol > 0,
    staleTime: 60_000,
    retry: false,
  })
}

/** Clientes sinalizados por GMUD agora (contrato -> GMUD). Falha silenciosa: sem dado, nada é marcado. */
export function useGmudActiveClients(enabled = true): Map<number, GmudActiveClient> {
  const query = useQuery({
    queryKey: ['gmud', 'active-clients'],
    queryFn: fetchGmudActiveClients,
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    retry: false,
  })
  return useMemo(() => {
    const map = new Map<number, GmudActiveClient>()
    for (const item of query.data ?? []) map.set(item.contractId, item)
    return map
  }, [query.data])
}
