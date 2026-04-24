import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchGeogridClientesAtendimentos } from '@/features/splitters/api/fetchGeogridClientesAtendimentos'
import { buildSplitterGeoGridComparison } from '@/features/splitters/lib/buildSplitterGeoGridComparison'
import { isGeogridConfigured } from '@/features/splitters/lib/geogridConfig'
import { SPLITTERS_LIST_STALE_TIME_MS } from '@/features/splitters/model/constants'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { SplitterGeoGridComparisonRow } from '@/features/splitters/model/splitterGeoGridComparison'
import { splittersKeys } from '@/features/splitters/model/splittersKeys'

export type SplitterGeoGridComparisonState =
  | { type: 'disabled' }
  | { type: 'not-configured' }
  | { type: 'idle' }
  | { type: 'loading' }
  | { type: 'error'; error: unknown }
  | { type: 'empty' }
  | { type: 'success'; rows: SplitterGeoGridComparisonRow[] }

export function useSplitterGeoGridComparison(
  splitterCode: string,
  splitterTitle: string | null | undefined,
  clientes: readonly SplitterCliente[],
  enabled: boolean,
): {
  state: SplitterGeoGridComparisonState
  refetch: () => void
} {
  const configured = isGeogridConfigured()
  const names = useMemo(
    () => clientes.map((cliente) => cliente.name.trim()).filter((name) => name !== ''),
    [clientes],
  )
  const canFetch = enabled && configured && splitterCode.trim() !== '' && names.length > 0

  const query = useQuery({
    queryKey: splittersKeys.geogridComparison(splitterCode, names),
    queryFn: ({ signal }) => fetchGeogridClientesAtendimentos(names, signal),
    staleTime: SPLITTERS_LIST_STALE_TIME_MS,
    enabled: canFetch,
  })

  const refetch = () => {
    void query.refetch()
  }

  if (clientes.length === 0) {
    return { state: { type: 'disabled' }, refetch }
  }

  if (!configured) {
    return { state: { type: 'not-configured' }, refetch }
  }

  if (!enabled) {
    return { state: { type: 'idle' }, refetch }
  }

  if (query.isPending) {
    return { state: { type: 'loading' }, refetch }
  }

  if (query.isError) {
    return { state: { type: 'error', error: query.error }, refetch }
  }

  const rows = buildSplitterGeoGridComparison(
    clientes,
    query.data ?? [],
    splitterCode,
    splitterTitle,
  )
  if (rows.length === 0) {
    return { state: { type: 'empty' }, refetch }
  }

  return { state: { type: 'success', rows }, refetch }
}
