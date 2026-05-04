import { type QueryClient, useQuery } from '@tanstack/react-query'
import { fetchNetworkStats, NETWORK_STATS_QUERY_KEY } from '@/shared/api/fetchNetworkStats'

/** Alinhado ao painel de inteligência para partilhar cache do BFF (`/api/stats`). */
const NETWORK_STATS_STALE_MS = 3 * 60_000

export function useNetworkStats() {
  return useQuery({
    queryKey: NETWORK_STATS_QUERY_KEY,
    queryFn: fetchNetworkStats,
    staleTime: NETWORK_STATS_STALE_MS,
    refetchInterval: 30_000,
  })
}

export function prefetchNetworkStats(queryClient: QueryClient): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: NETWORK_STATS_QUERY_KEY,
    queryFn: fetchNetworkStats,
    staleTime: NETWORK_STATS_STALE_MS,
  })
}
