import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchSplittersNetworkReliefQueueFromLocalDb } from '@/features/splitters/api/fetchSplittersNetworkReliefQueueFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export type { NetworkReliefQueueData } from '@/features/splitters/api/fetchSplittersNetworkReliefQueueFromLocalDb'

/**
 * Lista splitters secundários (filhos de primário) 100% ocupados sem alívio intra-condomínio
 * (outro secundário com mesmo trecho RES./COND./ED. no título e porta livre) e onde o BFF não
 * encontrou vizinho com porta livre dentro do limite de rota pedestre (OSRM foot).
 */
export function useSplittersNetworkReliefQueue(options: { enabled: boolean }) {
  return useInfiniteQuery({
    queryKey: [...splittersKeys.networkReliefQueue()],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchSplittersNetworkReliefQueueFromLocalDb({
        limit: 20,
        cursor: Number(pageParam) || 0,
        straightRadiusMeters: 500,
        maxRouteMeters: 200,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
    enabled: options.enabled,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    gcTime: 15 * 60_000,
  })
}
