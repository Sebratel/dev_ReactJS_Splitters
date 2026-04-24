import type { ClienteDetail } from '@/features/clientes/model/clienteDetail'

export function findClienteByAuthenticationId(
  list: ClienteDetail[],
  authenticationId: number,
): ClienteDetail | undefined {
  return list.find((c) => c.authenticationId === authenticationId)
}
