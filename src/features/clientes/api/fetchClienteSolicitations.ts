import { bffClient } from '@/shared/api/bffClient'
import {
  parseSolicitationFromApi,
  type Solicitation,
} from '@/features/clientes/model/solicitation'
import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * Paridade com `SolicitationService.fetchByAuthenticationId` em `lib/services/solicitation_service.dart`.
 * O segmento da URL é o **`clientId`** (`cliente.clientId` no Flutter), apesar do nome do método em Dart.
 */
export function listarSolicitacoesPath(clientId: number): string {
  return `/api/v1/splitters/solicitacoes/cliente/${encodeURIComponent(String(clientId))}`
}

export async function fetchClienteSolicitations(
  clientId: number,
  signal?: AbortSignal,
): Promise<Solicitation[]> {
  const data: unknown = await bffClient.request({
    path: listarSolicitacoesPath(clientId),
    method: 'GET',
    signal,
  })

  if (!isJsonObject(data) || !('response' in data)) {
    throw new Error(
      'Resposta inesperada ao listar solicitações (sem campo response).',
    )
  }

  const response = data.response
  if (!isJsonObject(response)) {
    throw new Error('Resposta inesperada: response não é um objeto.')
  }

  const raw = response.data
  const list = Array.isArray(raw) ? raw : []

  return list.map((item) => parseSolicitationFromApi(item))
}
