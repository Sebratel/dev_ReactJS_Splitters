import { geogridGetJson } from '@/features/splitters/api/geogridHttp'
import {
  parseGeogridClientesAtendimentosResponse,
  type GeogridClienteAtendimento,
} from '@/features/splitters/model/geogridClienteAtendimento'

const GEOGRID_CLIENTES_ATENDIMENTOS_TIMEOUT_MS = 30_000

export async function fetchGeogridClientesAtendimentos(
  names: readonly string[],
  signal?: AbortSignal,
): Promise<GeogridClienteAtendimento[]> {
  const normalized = [...new Set(names.map((name) => name.trim()).filter((name) => name !== ''))]
  if (normalized.length === 0) return []

  const params = new URLSearchParams({
    nomes: normalized.join(','),
    pagina: '1',
    registrosPorPagina: '20',
  })

  const body = await geogridGetJson(`/clientesAtendimentos?${params.toString()}`, {
    signal,
    timeoutMs: GEOGRID_CLIENTES_ATENDIMENTOS_TIMEOUT_MS,
  })
  return parseGeogridClientesAtendimentosResponse(body)
}
