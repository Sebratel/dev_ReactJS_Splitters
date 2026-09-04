import { useQuery } from '@tanstack/react-query'
import { fetchUsageSummary } from '@/features/analytics/api/fetchUsageSummary'

export const USAGE_SUMMARY_QUERY_KEY = (days: number) => ['usage', 'summary', days] as const

/** Radar de uso: sumário agregado por período (dias). Atualiza a cada 60s. */
export function useUsageAnalytics(days: number) {
  return useQuery({
    queryKey: USAGE_SUMMARY_QUERY_KEY(days),
    queryFn: () => fetchUsageSummary(days),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
