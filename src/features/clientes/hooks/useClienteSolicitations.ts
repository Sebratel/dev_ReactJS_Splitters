import { useQuery } from '@tanstack/react-query'
import { fetchClienteSolicitations } from '@/features/clientes/api/fetchClienteSolicitations'
import { CLIENTE_SOLICITATIONS_STALE_TIME_MS } from '@/features/clientes/model/constants'
import { clientesKeys } from '@/features/clientes/model/clientesKeys'
import type { Solicitation } from '@/features/clientes/model/solicitation'

/**
 * Histórico de solicitações do cliente.
 *
 * **Identificador:** no Flutter, `ClienteDetailPage` chama
 * `fetchByAuthenticationId(cliente.clientId)` — ou seja, o path usa **`clientId`**, não `authenticationId`.
 */
export type ClienteSolicitationsViewState =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'empty' }
  | { status: 'success'; items: Solicitation[] }

export function useClienteSolicitations(clientId: number): {
  view: ClienteSolicitationsViewState
  refetch: () => void
} {
  const enabled = clientId > 0

  const query = useQuery({
    queryKey: clientesKeys.solicitations(clientId),
    queryFn: ({ signal }) => fetchClienteSolicitations(clientId, signal),
    staleTime: CLIENTE_SOLICITATIONS_STALE_TIME_MS,
    enabled,
  })

  const refetch = () => {
    void query.refetch()
  }

  if (!enabled) {
    return { view: { status: 'disabled' }, refetch }
  }

  if (query.isPending) {
    return { view: { status: 'loading' }, refetch }
  }

  if (query.isError) {
    return {
      view: { status: 'error', error: query.error },
      refetch,
    }
  }

  const items = query.data ?? []
  if (items.length === 0) {
    return { view: { status: 'empty' }, refetch }
  }

  return { view: { status: 'success', items }, refetch }
}
