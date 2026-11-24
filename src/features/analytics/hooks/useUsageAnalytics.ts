import { useQuery } from '@tanstack/react-query'
import {
  fetchUsageSummary,
  type UsageSummaryQuery,
} from '@/features/analytics/api/fetchUsageSummary'

export const USAGE_SUMMARY_QUERY_KEY = (query: UsageSummaryQuery) =>
  [
    'usage',
    'summary',
    query.days ?? null,
    query.start ?? null,
    query.end ?? null,
    query.userEmail ?? null,
  ] as const

/** Radar de uso: sumário agregado por preset de dias ou intervalo, opcionalmente de um usuário. */
export function useUsageAnalytics(query: UsageSummaryQuery) {
  return useQuery({
    queryKey: USAGE_SUMMARY_QUERY_KEY(query),
    queryFn: () => fetchUsageSummary(query),
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
