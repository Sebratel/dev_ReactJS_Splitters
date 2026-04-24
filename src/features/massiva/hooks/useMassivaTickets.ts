import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { fetchMassivas } from '@/features/massiva/api/fetchMassivas'
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

function connectivityFromQuery(
  configured: boolean,
  query: UseQueryResult<MassivaTicket[], Error>,
): MassivaListConnectivity {
  if (!configured) return idleConnectivity
  return {
    configured: true,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching,
    dataUpdatedAt: query.dataUpdatedAt,
    error: query.isError ? query.error : undefined,
  }
}

/**
 * Lista somente leitura de massivas (BFF). Desabilita a query se `VITE_MASSIVA_LIST_PATH` estiver vazio.
 */
export function useMassivaTickets(): {
  view: MassivaTicketsViewState
  refetch: () => void
  isRefreshing: boolean
  listConnectivity: MassivaListConnectivity
} {
  const configured = env.massivaListPath.trim().length > 0

  const query = useQuery({
    queryKey: massivaKeys.list(),
    queryFn: fetchMassivas,
    staleTime: MASSIVA_LIST_STALE_TIME_MS,
    enabled: configured,
    refetchInterval: 5 * 60 * 1000,
  })

  const refetch = () => {
    void query.refetch()
  }

  const listConnectivity = connectivityFromQuery(configured, query)

  if (!configured) {
    return {
      view: { status: 'not-configured' },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  if (query.isPending) {
    return {
      view: { status: 'loading' },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  if (query.isError) {
    return {
      view: { status: 'error', error: query.error },
      refetch,
      isRefreshing: false,
      listConnectivity,
    }
  }

  const tickets = query.data ?? []
  if (tickets.length === 0) {
    return {
      view: { status: 'empty' },
      refetch,
      isRefreshing: query.isFetching,
      listConnectivity,
    }
  }

  return {
    view: { status: 'success', tickets },
    refetch,
    isRefreshing: query.isFetching,
    listConnectivity,
  }
}
