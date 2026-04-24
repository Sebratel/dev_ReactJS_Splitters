import { useQuery } from '@tanstack/react-query'
import { fetchSplittersFilterOptionsFromLocalDb } from '@/features/splitters/api/fetchSplittersFilterOptionsFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function useSplittersFilterOptions() {
  return useQuery({
    queryKey: splittersKeys.filterOptions(),
    queryFn: fetchSplittersFilterOptionsFromLocalDb,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
