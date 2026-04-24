import { bffClient } from '@/shared/api/bffClient'
import { parseSplitterFromApi } from '@/features/splitters/model/splitter'
import type { Splitter } from '@/features/splitters/model/splitter'
import { isJsonObject } from '@/shared/lib/typeGuards'

/** Paridade com `splittersEndpoint` em `main.dart` (path no BFF). */
export const SPLITTERS_LIST_PATH = '/api/v1/splitters/listarSplitters' as const

/**
 * GET listar splitters — equivalente a `SplitterService.fetchSplitters` quando
 * o cache Hive está inválido (rede + parse de `response`).
 */
export async function fetchSplitters(): Promise<Splitter[]> {
  const data: unknown = await bffClient.request({
    path: SPLITTERS_LIST_PATH,
    method: 'GET',
  })

  if (!isJsonObject(data) || !('response' in data)) {
    throw new Error('Resposta inesperada ao listar splitters (sem campo response).')
  }

  const list = data.response
  if (!Array.isArray(list)) {
    throw new Error('Resposta inesperada: response não é uma lista.')
  }

  return list.map((item) => parseSplitterFromApi(item))
}
