import { useQuery } from '@tanstack/react-query'
import { fetchOltsFromLocalDb } from '@/features/splitters/api/fetchOltsFromLocalDb'
import { findOltByCode } from '@/features/splitters/lib/findOltByCode'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { Olt } from '@/features/splitters/model/olt'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Resolve a OLT pelo código operacional (`OltService.getBySplitterCode(oltCode)` no Flutter).
 * Só o código — sem objeto splitter — para baixo acoplamento e reuso.
 *
 * Query global `listarOlts` + `select` por código (cache compartilhado).
 *
 * Próximos passos: invalidar `splittersKeys.olts()` quando houver refresh explícito de OLTs.
 */
export type SplitterOltState =
  | { type: 'no-olt-code' }
  | { type: 'loading' }
  | { type: 'error'; error: unknown }
  | { type: 'not-found' }
  | { type: 'ready'; olt: Olt }

export function useSplitterOlt(oltCode?: string | null): {
  state: SplitterOltState
  refetch: () => void
} {
  const code = (oltCode ?? '').trim()
  const hasOltCode = code.length > 0

  const query = useQuery({
    queryKey: splittersKeys.olts(),
    queryFn: fetchOltsFromLocalDb,
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    enabled: hasOltCode,
    select: (list: Olt[]) => findOltByCode(list, code),
  })

  const refetch = () => {
    void query.refetch()
  }

  if (!hasOltCode) {
    return { state: { type: 'no-olt-code' }, refetch }
  }

  if (query.isPending) {
    return { state: { type: 'loading' }, refetch }
  }

  if (query.isError) {
    return { state: { type: 'error', error: query.error }, refetch }
  }

  if (query.data === undefined) {
    return { state: { type: 'not-found' }, refetch }
  }

  return { state: { type: 'ready', olt: query.data }, refetch }
}
