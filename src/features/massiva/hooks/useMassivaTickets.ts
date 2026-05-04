import { useMemo } from 'react'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchMassivaAfetadosCountsByProtocols } from '@/features/massiva/api/fetchMassivaAfetadosCounts'
import { fetchMassivasListCore } from '@/features/massiva/api/fetchMassivas'
import { mergeMassivaTicketsAfetados } from '@/features/massiva/lib/mergeMassivaTicketsAfetados'
import { MASSIVA_LIST_STALE_TIME_MS } from '@/features/massiva/model/constants'
import { massivaKeys } from '@/features/massiva/model/massivaKeys'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'
import { env } from '@/shared/config/env'

export type MassivaTicketsViewState =
  | { status: 'not-configured' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty' }
  | { status: 'success'; tickets: MassivaTicket[] }

/** Metadados da query de listagem — útil para painel de conectividade. */
export type MassivaListConnectivity = {
  configured: boolean
  isPending: boolean
  isError: boolean
  isFetching: boolean
  dataUpdatedAt: number
  error: unknown | undefined
}

const idleConnectivity: MassivaListConnectivity = {
  configured: false,
  isPending: false,
  isError: false,
  isFetching: false,
  dataUpdatedAt: 0,
  error: undefined,
}

function connectivityFromListAndAfetados(
  configured: boolean,
  listQuery: UseQueryResult<MassivaTicket[], Error>,
  afetadosQuery: UseQueryResult<MassivaTicket[], Error>,
): MassivaListConnectivity {
  if (!configured) return idleConnectivity
  return {
    configured: true,
    isPending: listQuery.isPending,
    isError: listQuery.isError,
    isFetching: listQuery.isFetching || afetadosQuery.isFetching,
    dataUpdatedAt: Math.max(listQuery.dataUpdatedAt, afetadosQuery.dataUpdatedAt),
    error: listQuery.isError ? listQuery.error : undefined,
  }
}

export type UseMassivaTicketsOptions = {
  /** Quando `false`, não chama o BFF (ex.: utilizador sem permissão de massiva). */
  enabled?: boolean
}

function protocolsFingerprintFromTickets(rows: MassivaTicket[] | undefined): string {
  if (rows == null || rows.length === 0) return ''
  const u = new Set<number>()
  for (const t of rows) {
    if (Number.isFinite(t.protocol) && t.protocol > 0) {
      u.add(Math.trunc(t.protocol))
    }
  }
  if (u.size === 0) return ''
  return [...u].sort((a, b) => a - b).join(',')
}

/**
 * Lista somente leitura de massivas (BFF). Listagem principal e enriquecimento de afetados são
 * queries separadas: a UI deixa de esperar todos os GET por protocolo antes de mostrar dados.
 */
export function useMassivaTickets(options?: UseMassivaTicketsOptions): {
  view: MassivaTicketsViewState
  refetch: () => void
  isRefreshing: boolean
  listConnectivity: MassivaListConnectivity
} {
  const configured = env.massivaListPath.trim().length > 0
  const userEnabled = options?.enabled !== false
  const baseEnabled = configured && userEnabled
  const afetadosConfigured = env.massivaAfetadosPath.trim() !== ''

  const listQuery = useQuery({
    queryKey: massivaKeys.list(),
    queryFn: fetchMassivasListCore,
    staleTime: MASSIVA_LIST_STALE_TIME_MS,
    enabled: baseEnabled,
    refetchInterval: baseEnabled ? 5 * 60 * 1000 : false,
    retry: 1,
  })

  const protocolsFingerprint = useMemo(
    () => protocolsFingerprintFromTickets(listQuery.data),
    [listQuery.data],
  )

  const afetadosQuery = useQuery({
    queryKey: massivaKeys.listAfetados(protocolsFingerprint || '—'),
    queryFn: async () => {
      const base = listQuery.data
      if (base == null || base.length === 0) return []
      const map = await fetchMassivaAfetadosCountsByProtocols(base.map((t) => t.protocol))
      return mergeMassivaTicketsAfetados(base, map)
    },
    staleTime: MASSIVA_LIST_STALE_TIME_MS,
    enabled:
      baseEnabled &&
      afetadosConfigured &&
      listQuery.isSuccess &&
      protocolsFingerprint !== '',
    refetchInterval:
      baseEnabled && afetadosConfigured && protocolsFingerprint !== ''
        ? 5 * 60 * 1000
        : false,
    retry: 0,
  })

  const refetch = () => {
    void listQuery.refetch()
    void afetadosQuery.refetch()
  }

  const listConnectivity = connectivityFromListAndAfetados(
    configured,
    listQuery,
    afetadosQuery,
  )

  if (!configured) {
    return {
      view: { status: 'not-configured' },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  if (!userEnabled) {
    return {
      view: { status: 'success', tickets: [] },
      refetch,
      isRefreshing: false,
      listConnectivity: idleConnectivity,
    }
  }

  if (listQuery.isPending) {
    return {
      view: { status: 'loading' },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  if (listQuery.isError) {
    return {
      view: { status: 'error', error: listQuery.error },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  const base = listQuery.data ?? []
  const tickets =
    afetadosConfigured && afetadosQuery.isSuccess && afetadosQuery.data != null
      ? afetadosQuery.data
      : base

  const isRefreshing = listQuery.isFetching || afetadosQuery.isFetching

  if (tickets.length === 0) {
    return {
      view: { status: 'empty' },
      refetch,
      isRefreshing,
      listConnectivity,
    }
  }

  return {
    view: { status: 'success', tickets },
    refetch,
    isRefreshing,
    listConnectivity,
  }
}
