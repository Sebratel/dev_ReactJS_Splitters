import { useQuery } from '@tanstack/react-query'
import { fetchCancellationsSummary } from '@/features/cancellations/api/fetchCancellationsSummary'

/** Cancelamentos por área a partir de `startIso` (YYYY-MM-DD). Cache de 10min no BFF. */
export function useCancellationsSummary(startIso: string) {
  return useQuery({
    queryKey: ['cancellations', 'summary', startIso],
    queryFn: () => fetchCancellationsSummary(startIso),
    staleTime: 5 * 60_000,
  })
}
