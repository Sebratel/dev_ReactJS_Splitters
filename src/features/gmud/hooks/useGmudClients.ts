import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  estimateGmudClientImpact,
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

/**
 * Estimativa de clientes impactados enquanto o formulário é preenchido. O escopo vai na chave da consulta
 * (já "assentado" por quem chama, com debounce), então cada mudança de escopo refaz a conta.
 */
export function useGmudClientImpactEstimate(
  input: { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] },
  enabled = true,
) {
  const popSite = input.popSite.trim()
  return useQuery({
    queryKey: ['gmud', 'client-impact-estimate', popSite, JSON.stringify(input.escopoRotas), JSON.stringify(input.clientesSemSplitter)],
    queryFn: ({ signal }) => estimateGmudClientImpact({ ...input, popSite }, signal),
    enabled: enabled && popSite !== '',
    staleTime: 60_000,
    retry: false,
    placeholderData: (previous) => previous,
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
