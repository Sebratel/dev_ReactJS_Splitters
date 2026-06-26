import { useQuery } from '@tanstack/react-query'
import { fetchProjectedSignalsBatch } from '@/features/onu/api/fetchProjectedSignalsBatch'
import { onuKeys } from '@/features/onu/model/onuKeys'
import { normalizeClientName, type ProjectedSignal } from '@/features/onu/model/projectedSignal'

/**
 * Sinal projetado em lote para a lista de clientes, casado por nome normalizado.
 * Sem polling (dado de projeto, muda raramente) — o `rxPower` real continua
 * com polling de 60s pelo hook de diagnóstico; só o projetado é cacheado longo.
 */
export function useProjectedSignalsBatch(
  names: readonly string[],
  options?: { enabled?: boolean },
) {
  const list = Array.from(
    new Set(names.map((n) => String(n ?? '').trim()).filter(Boolean)),
  )
  const enabled = (options?.enabled ?? true) && list.length > 0

  return useQuery<Map<string, ProjectedSignal>>({
    queryKey: [...onuKeys.all, 'projected-batch', [...list].map(normalizeClientName).sort().join('|')],
    queryFn: () => fetchProjectedSignalsBatch(list),
    enabled,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  })
}
