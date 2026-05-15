import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchSplittersNetworkReliefQueueFromLocalDb } from '@/features/splitters/api/fetchSplittersNetworkReliefQueueFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'
import { useSplittersFiltersStore } from '@/features/splitters/store/useSplittersFiltersStore'

export type { NetworkReliefQueueData } from '@/features/splitters/api/fetchSplittersNetworkReliefQueueFromLocalDb'

/**
 * Lista splitters secundários (filhos de primário) 100% ocupados sem alívio intra-condomínio
 * (outro secundário com mesmo trecho RES./COND./ED. no título e porta livre) e onde o BFF não
 * encontrou vizinho com porta livre dentro do limite de rota pedestre (OSRM foot).
 */
export function useSplittersNetworkReliefQueue(options: { enabled: boolean }) {
  const oltSlot = useSplittersFiltersStore((s) =>
    typeof s.state.oltSlot === 'number' && Number.isFinite(s.state.oltSlot)
      ? s.state.oltSlot
      : null,
  )
  const oltPort = useSplittersFiltersStore((s) =>
    typeof s.state.oltPort === 'number' && Number.isFinite(s.state.oltPort)
      ? s.state.oltPort
      : null,
  )

  const ponKeyed = oltSlot !== null || oltPort !== null

  return useInfiniteQuery({
    queryKey: [...splittersKeys.networkReliefQueue(), oltSlot, oltPort, ponKeyed ? 'pon' : 'full'],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      fetchSplittersNetworkReliefQueueFromLocalDb({
        limit: 20,
        cursor: Number(pageParam) || 0,
        straightRadiusMeters: 500,
        maxRouteMeters: 200,
        oltSlot,
        oltPort,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor !== null ? lastPage.nextCursor : undefined,
    enabled: options.enabled,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    gcTime: 15 * 60_000,
  })
}
