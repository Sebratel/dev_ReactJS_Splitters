import { useQuery } from '@tanstack/react-query'
import { buildGeogridReservaRows } from '@/features/splitters/api/buildGeogridReservaRows'
import { isGeogridConfigured } from '@/features/splitters/lib/geogridConfig'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { GeogridReservaRow } from '@/features/splitters/model/geogridReservaRow'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export type SplitterGeoGridState =
  | { type: 'no-integration-code' }
  | { type: 'not-configured' }
  | { type: 'loading' }
  | { type: 'error'; error: unknown }
  | { type: 'empty' }
  | { type: 'success'; rows: GeogridReservaRow[] }

/**
 * Carrega portas GeoGrid + nomes de cliente nas reservas “com cadeado” (`integrationCode` do splitter).
 * Paridade com `_loadReservasGeoGrid` + `_loadNomesClientesReservaGeoGrid` no Flutter.
 */
export function useSplitterGeoGrid(integrationCode?: string | null): {
  state: SplitterGeoGridState
  refetch: () => void
} {
  const code = (integrationCode ?? '').trim()
  const configured = isGeogridConfigured()
  const canFetch = code.length > 0 && configured

  const query = useQuery({
    queryKey: splittersKeys.geogrid(code.length > 0 ? code : '__none__'),
    queryFn: ({ signal }) => buildGeogridReservaRows(code, signal),
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    enabled: canFetch,
  })

  const refetch = () => {
    void query.refetch()
  }

  if (code.length === 0) {
    return { state: { type: 'no-integration-code' }, refetch }
  }

  if (!configured) {
    return { state: { type: 'not-configured' }, refetch }
  }

  if (query.isPending) {
    return { state: { type: 'loading' }, refetch }
  }

  if (query.isError) {
    return { state: { type: 'error', error: query.error }, refetch }
  }

  const rows = query.data ?? []
  if (rows.length === 0) {
    return { state: { type: 'empty' }, refetch }
  }

  return { state: { type: 'success', rows }, refetch }
}
