import { useQuery } from '@tanstack/react-query'
import { fetchProjectedSignal } from '@/features/onu/api/fetchProjectedSignal'
import { onuKeys } from '@/features/onu/model/onuKeys'
import type { ProjectedSignal } from '@/features/onu/model/projectedSignal'

/**
 * Sinal projetado da porta (GeoGrid), casado por nome do cliente. Muda raramente
 * (é de projeto), então não faz polling — só revalida em foco.
 */
export function useProjectedSignal(
  clientName: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const name = (clientName ?? '').trim()
  const enabled = (options?.enabled ?? true) && name.length > 0

  return useQuery<ProjectedSignal | null>({
    queryKey: enabled
      ? [...onuKeys.all, 'projected', name]
      : [...onuKeys.all, 'projected', '__none__'],
    queryFn: () => fetchProjectedSignal(name),
    enabled,
    staleTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  })
}
