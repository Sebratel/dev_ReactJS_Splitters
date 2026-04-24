import { fetchGeogridClienteNome } from '@/features/splitters/api/fetchGeogridClienteNome'
import { fetchGeogridPortasMap } from '@/features/splitters/api/fetchGeogridPortasMap'
import type { GeogridReservaRow } from '@/features/splitters/model/geogridReservaRow'

const GEOGRID_CLIENT_NAME_CONCURRENCY = 2

async function mapWithConcurrency<TInput, TOutput>(
  items: readonly TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) return []

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length))
  const results = new Array<TOutput>(items.length)
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      results[currentIndex] = await mapper(items[currentIndex]!)
    }
  }

  await Promise.all(Array.from({ length: safeConcurrency }, () => worker()))
  return results
}

/**
 * Orquestra portas + nomes para portas com `idCliente`.
 *
 * Regras para poupar a GeoGrid:
 * - so tenta resolver nome quando existe reserva de fato na porta
 * - usa cache TTL por `idCliente`
 * - limita concorrencia para evitar estouro de rate limit
 */
export async function buildGeogridReservaRows(
  integrationCode: string,
  signal?: AbortSignal,
): Promise<GeogridReservaRow[]> {
  const map = await fetchGeogridPortasMap(integrationCode, signal)
  const sorted = [...map.entries()].sort((a, b) => a[0] - b[0])

  const idsNeedingNames = [
    ...new Set(
      sorted
        .map(([, p]) => (p.hasReserva && p.idCliente ? p.idCliente : null))
        .filter((value): value is string => value !== null),
    ),
  ]

  const nomeById = new Map<string, string>()
  const resolved = await mapWithConcurrency(
    idsNeedingNames,
    GEOGRID_CLIENT_NAME_CONCURRENCY,
    async (cid) => ({
      cid,
      nome: await fetchGeogridClienteNome(cid, signal),
    }),
  )

  for (const item of resolved) {
    if (item.nome) nomeById.set(item.cid, item.nome)
  }

  return sorted.map(([portaNum, p]) => ({
    ...p,
    porta: portaNum,
    clienteNome: p.idCliente ? nomeById.get(p.idCliente) ?? null : null,
  }))
}
