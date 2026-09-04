import { useQuery } from '@tanstack/react-query'
import { fetchUsageSummary } from '@/features/analytics/api/fetchUsageSummary'

export const USAGE_SUMMARY_QUERY_KEY = (days: number, userEmail?: string | null) =>
  ['usage', 'summary', days, userEmail ?? null] as const

/** Radar de uso: sumário agregado por período (dias), opcionalmente de um usuário. */
export function useUsageAnalytics(days: number, userEmail?: string | null) {
  return useQuery({
    queryKey: USAGE_SUMMARY_QUERY_KEY(days, userEmail),
    queryFn: () => fetchUsageSummary(days, userEmail),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
