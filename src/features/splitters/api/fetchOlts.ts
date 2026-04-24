import { bffClient } from '@/shared/api/bffClient'
import { parseOltFromApi, type Olt } from '@/features/splitters/model/olt'
import { isJsonObject } from '@/shared/lib/typeGuards'

/** Paridade com `OltService._endpoint` — path relativo ao BFF. */
export const OLTS_LIST_PATH = '/api/v1/splitters/listarOlts' as const

export async function fetchOlts(): Promise<Olt[]> {
  const data: unknown = await bffClient.request({
    path: OLTS_LIST_PATH,
    method: 'GET',
  })

  if (!isJsonObject(data) || !('response' in data)) {
    throw new Error('Resposta inesperada ao listar OLTs (sem campo response).')
  }

  const list = data.response
  if (!Array.isArray(list)) {
    throw new Error('Resposta inesperada: response não é uma lista.')
  }

  return list.map((item) => parseOltFromApi(item))
}
