import { useQuery } from '@tanstack/react-query'
import { fetchOnuNetworkSummary } from '@/features/onu/api/fetchOnuNetworkSummary'
import { onuKeys, ONU_POLL_INTERVAL_MS } from '@/features/onu/model/onuKeys'
import type { OnuNetworkSummary } from '@/features/onu/model/onuNetworkSummary'

/**
 * Resumo agregado da saúde de sinal da rede, com polling (60s). O servidor
 * cacheia o cálculo por 60s, então o polling é barato.
 */
export function useOnuNetworkSummary(options?: { enabled?: boolean }) {
  return useQuery<OnuNetworkSummary | null>({
    queryKey: [...onuKeys.all, 'summary'],
    queryFn: fetchOnuNetworkSummary,
    enabled: options?.enabled ?? true,
    staleTime: ONU_POLL_INTERVAL_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })
}
