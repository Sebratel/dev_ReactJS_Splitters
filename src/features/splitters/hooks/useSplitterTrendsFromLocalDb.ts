import { useQuery } from '@tanstack/react-query'
import { fetchSplitterTrendsFromLocalDb } from '@/features/splitters/api/fetchSplitterTrendsFromLocalDb'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function useSplitterTrendsFromLocalDb(splitterCodes: readonly string[]) {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]

  return useQuery({
    queryKey: splittersKeys.trendsBySplitters(clean),
    queryFn: () => fetchSplitterTrendsFromLocalDb(clean),
    enabled: clean.length > 0,
    staleTime: 60_000,
  })
}
