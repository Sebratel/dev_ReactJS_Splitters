import { useQuery } from '@tanstack/react-query'
import { fetchSplitterConnectionsBundleFromLocalDb } from '@/features/splitters/api/fetchSplitterConnectionsFromLocalDb'
import { SPLITTERS_CONNECTIONS_STALE_TIME_MS } from '@/features/splitters/model/constants'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Clientes ligados a um splitter, sincronizados com o banco de dados.
 * A filtragem por código é feita server-side pelo endpoint /api/splitters/:code/connections.
 */
export function useSplitterClientes(splitterCode: string | undefined) {
  const code = (splitterCode ?? '').trim()

  return useQuery({
    queryKey: [...splittersKeys.connections(), code],
    queryFn: () => fetchSplitterConnectionsBundleFromLocalDb(code),
    staleTime: SPLITTERS_CONNECTIONS_STALE_TIME_MS,
    enabled: code.length > 0,
  })
}
