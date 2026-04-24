import { bffClient } from '@/shared/api/bffClient'
import {
  parseSplitterClienteFromApi,
  type SplitterCliente,
} from '@/features/splitters/model/splitterCliente'
import { isJsonObject } from '@/shared/lib/typeGuards'

/** Paridade com `clientesEndpoint` / `listarConnections` no `main.dart`. */
export const SPLITTER_CONNECTIONS_PATH =
  '/api/v1/splitters/listarConnections' as const

/**
 * Carga global de conexões (mesmo payload que `refreshClientesCache` processa no Flutter).
 * Filtro por splitter fica no hook via `select`, para um único cache entre telas.
 */
export async function fetchSplitterConnections(): Promise<SplitterCliente[]> {
  const data: unknown = await bffClient.request({
    path: SPLITTER_CONNECTIONS_PATH,
    method: 'GET',
  })

  if (!isJsonObject(data) || !('response' in data)) {
    throw new Error(
      'Resposta inesperada ao listar conexões (sem campo response).',
    )
  }

  const list = data.response
  if (!Array.isArray(list)) {
    throw new Error('Resposta inesperada: response não é uma lista.')
  }

  return list.map((item) => parseSplitterClienteFromApi(item))
}
