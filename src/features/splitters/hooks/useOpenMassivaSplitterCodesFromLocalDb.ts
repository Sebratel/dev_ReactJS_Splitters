import { useQuery } from '@tanstack/react-query'
import { fetchOpenMassivaSplitterCodesFromLocalDb } from '@/features/splitters/api/fetchOpenMassivaSplitterCodesFromLocalDb'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export function useOpenMassivaSplitterCodesFromLocalDb() {
  return useQuery({
    queryKey: splittersKeys.openMassivaSplitterCodes(),
    queryFn: fetchOpenMassivaSplitterCodesFromLocalDb,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
