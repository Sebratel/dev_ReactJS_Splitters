import { useQuery } from '@tanstack/react-query'
import { fetchClientePatrimonies } from '@/features/clientes/api/fetchClientePatrimonies'
import { clientesKeys } from '@/features/clientes/model/clientesKeys'
import type { ClientePatrimony } from '@/features/clientes/model/clientePatrimony'

/**
 * Patrimônios (equipamentos) do cliente. Identificador: `clientId`
 * (= cliente.clientId = people.id), não o authenticationId da rota.
 */
export function useClientePatrimonies(clientId: number) {
  const enabled = clientId > 0

  return useQuery<ClientePatrimony[]>({
    queryKey: clientesKeys.patrimonies(clientId),
    queryFn: ({ signal }) => fetchClientePatrimonies(clientId, signal),
    enabled,
    staleTime: 5 * 60_000,
  })
}
