import { useQuery } from '@tanstack/react-query'
import { fetchOltsFromLocalDb } from '@/features/splitters/api/fetchOltsFromLocalDb'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Lista global de OLTs sincronizada diretamente com o banco de dados.
 */
export function useOltsForFilters() {
  return useQuery({
    queryKey: splittersKeys.olts(),
    queryFn: fetchOltsFromLocalDb,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
  })
}
