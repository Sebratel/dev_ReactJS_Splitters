import { splittersKeys } from '@/features/splitters/model/splittersKeys'

/**
 * Detalhe do cliente (etapa 1) não tem GET dedicado no BFF: compartilha o cache de
 * `listarConnections` com a feature splitters.
 */
export function sharedListarConnectionsQueryKey() {
  return splittersKeys.connections()
}
