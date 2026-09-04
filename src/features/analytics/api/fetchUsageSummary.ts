import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { UsageSummary } from '@/features/analytics/model/usageSummary'

/** Busca o sumário agregado do radar de uso (somente admin) para os últimos `days`. */
export async function fetchUsageSummary(days: number, userEmail?: string | null): Promise<UsageSummary> {
  const params = new URLSearchParams({ days: String(days) })
  if (userEmail && userEmail.trim() !== '') params.set('user', userEmail.trim())
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
