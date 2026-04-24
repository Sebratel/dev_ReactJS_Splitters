import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSplitterConnections } from '@/features/splitters/api/fetchSplitterConnections'
import { buildSplittersConnectionsDerivedIndexes } from '@/features/splitters/lib/buildSplittersConnectionsDerivedIndexes'
import type { SplittersOccupancyCountIndex } from '@/features/splitters/lib/buildSplittersOccupancyCountIndex'
import { SPLITTERS_CONNECTIONS_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { SplittersListClientSearchMode } from '@/features/splitters/model/splittersListClientSearch'
import type { SplittersClientNamesIndex } from '@/features/splitters/model/splitterListFilterRowContext'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

function deriveClientSearchMode(
  data: unknown,
  isError: boolean,
): SplittersListClientSearchMode {
  if (data !== undefined) return 'ready'
  if (isError) return 'degraded'
  return 'loading'
}

/**
 * Mesma query global que `useSplitterClientes` (`splittersKeys.connections` + `fetchSplitterConnections`).
 * Deriva índices para a listagem (nomes + ocupação) num único `useMemo` / uma passagem nos dados.
 */
export function useSplitterConnectionsClientNamesIndex(): {
  clientNamesIndex: SplittersClientNamesIndex | undefined
  occupancyCountBySplitterCode: SplittersOccupancyCountIndex | undefined
  clientSearchMode: SplittersListClientSearchMode
  refetch: () => void
  isFetching: boolean
} {
  const query = useQuery({
    queryKey: splittersKeys.connections(),
    queryFn: fetchSplitterConnections,
    staleTime: SPLITTERS_CONNECTIONS_STALE_TIME_MS,
  })

  const derived = useMemo((): {
    clientNamesIndex: SplittersClientNamesIndex | undefined
    occupancyCountBySplitterCode: SplittersOccupancyCountIndex | undefined
  } => {
    if (query.data === undefined) {
      return {
        clientNamesIndex: undefined,
        occupancyCountBySplitterCode: undefined,
      }
    }
    return buildSplittersConnectionsDerivedIndexes(query.data)
  }, [query.data])

  const clientSearchMode = deriveClientSearchMode(query.data, query.isError)

  const refetch = () => {
    void query.refetch()
  }

  return {
    clientNamesIndex: derived.clientNamesIndex,
    occupancyCountBySplitterCode: derived.occupancyCountBySplitterCode,
    clientSearchMode,
    refetch,
    isFetching: query.isFetching,
  }
}
