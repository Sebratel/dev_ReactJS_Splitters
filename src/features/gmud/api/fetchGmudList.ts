import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudListResult } from '@/features/gmud/model/gmud'

/** Lista as GMUDs (somente admin/permissão) direto do Voalle, via BFF local. */
export async function fetchGmudList(params: {
  limit?: number
  offset?: number
  q?: string
}): Promise<GmudListResult> {
  const qs = new URLSearchParams()
  if (params.limit) qs.set('limit', String(params.limit))
  if (params.offset) qs.set('offset', String(params.offset))
  if (params.q && params.q.trim() !== '') qs.set('q', params.q.trim())

  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/list?${qs.toString()}`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message =
      (result && typeof result.message === 'string' && result.message) ||
      'Falha ao carregar as GMUDs.'
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as GmudListResult
}
