import { useQuery } from '@tanstack/react-query'
import { fetchPrimarySplittersFromLocalDb } from '@/features/splitters/api/fetchPrimarySplittersFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function usePrimarySplittersForFilters() {
  return useQuery({
    queryKey: splittersKeys.primarySplitters(),
    queryFn: fetchPrimarySplittersFromLocalDb,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
