import { useQuery } from '@tanstack/react-query'
import { fetchAccessPointsForFiltersFromLocalDb } from '@/features/splitters/api/fetchAccessPointsForFiltersFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function useAccessPointsForFilters() {
  return useQuery({
    queryKey: splittersKeys.accessPointsForFilters(),
    queryFn: fetchAccessPointsForFiltersFromLocalDb,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
