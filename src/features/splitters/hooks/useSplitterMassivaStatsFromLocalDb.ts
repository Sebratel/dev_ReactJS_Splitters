import { useQuery } from '@tanstack/react-query'
import { fetchSplitterMassivaStatsFromLocalDb } from '@/features/splitters/api/fetchSplitterMassivaStatsFromLocalDb'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function useSplitterMassivaStatsFromLocalDb(splitterCodes: readonly string[]) {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]

  return useQuery({
    queryKey: splittersKeys.massivaHistoryBySplitters(clean),
    queryFn: () => fetchSplitterMassivaStatsFromLocalDb(clean),
    enabled: clean.length > 0,
    staleTime: 30_000,
  })
}
