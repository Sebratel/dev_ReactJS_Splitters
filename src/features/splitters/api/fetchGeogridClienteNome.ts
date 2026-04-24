import { geogridGetJson } from '@/features/splitters/api/geogridHttp'
import {
  loadCachedGeogridClienteNome,
  saveCachedGeogridClienteNome,
} from '@/features/splitters/lib/geogridClienteNomeCache'
import { isJsonObject } from '@/shared/lib/typeGuards'

/**
 * `GET .../clientes/{id}` — paridade `GeoGridService.fetchClienteNomeById` (falha silenciosa → null).
 */
export async function fetchGeogridClienteNome(
  idCliente: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const id = idCliente.trim()
  if (id.length === 0) return null

  const cached = loadCachedGeogridClienteNome(id)
  if (cached !== null) return cached

  try {
    const body = await geogridGetJson(`/clientes/${encodeURIComponent(id)}`, signal)
    if (!isJsonObject(body)) return null
    const dados = isJsonObject(body.dados) ? body.dados : {}
    const nome = dados.nome === null || dados.nome === undefined
      ? ''
      : String(dados.nome).trim()
    if (nome.length > 0) {
      saveCachedGeogridClienteNome(id, nome)
      return nome
    }
    return null
  } catch {
    return null
  }
}
