import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  EMPTY_CANCELLATIONS_SUMMARY,
  type CancellationsSummary,
} from '@/features/cancellations/model/cancellationsSummary'

type ApiResponse = {
  success: boolean
  window: { start: string }
  data: CancellationsSummary
}

/**
 * Resumo de cancelamentos por área desde `startIso` (YYYY-MM-DD). Agregação é
 * server-side; a resposta já vem compacta. Usa localBffUrl + sessão como as demais
 * chamadas ao BFF (fetch relativo cai no fallback do SPA no deploy).
 */
export async function fetchCancellationsSummary(
  startIso: string,
): Promise<CancellationsSummary> {
  const url = `${env.localBffUrl}/api/cancellations/summary?start=${encodeURIComponent(startIso)}`
  const res = await fetchWithSessionAuth(url)
  if (res.status === 503) return EMPTY_CANCELLATIONS_SUMMARY
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse
  if (!json.success) throw new Error('API retornou success=false')
  return json.data
}
