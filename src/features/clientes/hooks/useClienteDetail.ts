import { useQuery } from '@tanstack/react-query'
import { fetchClienteDetailFromLocalDb } from '@/features/clientes/api/fetchClienteDetailFromLocalDb'
import { clientesKeys } from '@/features/clientes/model/clientesKeys'
import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'
import { CLIENTE_DETAIL_CONNECTIONS_STALE_TIME_MS } from '@/features/clientes/model/constants'

function parseAuthenticationIdParam(param: string | undefined): number | null {
  const raw = (param ?? '').trim()
  if (raw === '') return null
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export type ClienteDetailViewState =
  | { status: 'invalid-param' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'not-found' }
  | { status: 'ready'; cliente: ClienteDetail }

/**
 * Detalhe por `authenticationId` na URL via endpoint dedicado do BFF local.
 */
export function useClienteDetail(idParam: string | undefined): {
  state: ClienteDetailViewState
  refetch: () => void
} {
  const authenticationId = parseAuthenticationIdParam(idParam)

  const query = useQuery({
    queryKey:
      authenticationId === null
        ? [...clientesKeys.all, 'detail', '__none__']
        : clientesKeys.detail(authenticationId),
    queryFn: () =>
      authenticationId === null
        ? Promise.resolve(null)
        : fetchClienteDetailFromLocalDb(authenticationId),
    staleTime: CLIENTE_DETAIL_CONNECTIONS_STALE_TIME_MS,
    enabled: authenticationId !== null,
  })

  const refetch = () => {
    void query.refetch()
  }

  if (authenticationId === null) {
    return { state: { status: 'invalid-param' }, refetch }
  }

  if (query.isPending) {
    return { state: { status: 'loading' }, refetch }
  }

  if (query.isError) {
    return {
      state: { status: 'error', error: query.error },
      refetch,
    }
  }

  if (query.data === null) {
    return { state: { status: 'not-found' }, refetch }
  }

  return {
    state: { status: 'ready', cliente: query.data },
    refetch,
  }
}
