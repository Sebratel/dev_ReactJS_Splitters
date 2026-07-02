import { useQuery } from '@tanstack/react-query'
import {
  fetchCancellationsActiveBase,
  fetchMassivaImpact,
} from '@/features/cancellations/api/fetchCancellationsExtras'

/** Base ativa por local (denominador da taxa normalizada). */
export function useCancellationsActiveBase() {
  return useQuery({
    queryKey: ['cancellations', 'active-base'],
    queryFn: fetchCancellationsActiveBase,
    staleTime: 15 * 60_000,
  })
}

/** Ranking de áreas/condomínios em risco (massiva → churn). */
export function useMassivaImpact(startIso: string, windowDays = 30) {
  return useQuery({
    queryKey: ['cancellations', 'massiva-impact', startIso, windowDays],
    queryFn: () => fetchMassivaImpact(startIso, windowDays),
    staleTime: 5 * 60_000,
  })
}
