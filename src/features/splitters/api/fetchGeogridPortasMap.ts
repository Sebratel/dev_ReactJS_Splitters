import { geogridGetJson } from '@/features/splitters/api/geogridHttp'
import {
  mergeGeogridPortasIntoMap,
  type GeogridPortaWithDerived,
} from '@/features/splitters/model/geogridPorta'
import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * `GET .../equipamentos/{integrationCode}/portas` — paridade `GeoGridService.fetchReservasPorSplitter`.
 */
export async function fetchGeogridPortasMap(
  integrationCode: string,
  signal?: AbortSignal,
): Promise<Map<number, GeogridPortaWithDerived>> {
  const id = encodeURIComponent(integrationCode.trim())

  let body: unknown
  try {
    body = await geogridGetJson(`/equipamentos/${id}/portas`, signal)
  } catch {
    throw new Error('Erro ao buscar portas na GeoGrid')
  }

  if (!isJsonObject(body)) {
    throw new Error('Erro ao buscar portas na GeoGrid')
  }

  const portas = body.portas
  const list = Array.isArray(portas) ? portas : []

  return mergeGeogridPortasIntoMap(list)
}
