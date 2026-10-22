import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { UsageSummary } from '@/features/analytics/model/usageSummary'

/** Filtro do radar: um preset (`days`) OU um intervalo explícito (`start`/`end`, ISO), + colaborador. */
export type UsageSummaryQuery = {
  days?: number
  start?: string
  end?: string
  userEmail?: string | null
}

/** Busca o sumário agregado do radar de uso (somente admin) — por preset de dias ou intervalo. */
export async function fetchUsageSummary(query: UsageSummaryQuery): Promise<UsageSummary> {
  const params = new URLSearchParams()
  if (query.start && query.end) {
    params.set('start', query.start)
    params.set('end', query.end)
  } else {
    params.set('days', String(query.days ?? 7))
  }
  if (query.userEmail && query.userEmail.trim() !== '') params.set('user', query.userEmail.trim())
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/usage-events/summary?${params.toString()}`,
  )
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) ||
      'Falha ao carregar o radar de uso.'
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as UsageSummary
}
