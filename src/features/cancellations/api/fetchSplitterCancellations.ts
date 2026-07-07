import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  EMPTY_SPLITTER_CANCELLATIONS,
  type SplitterCancellations,
} from '@/features/cancellations/model/splitterCancellations'

type ApiResponse = {
  success: boolean
  window: { start: string }
  data: SplitterCancellations
}

export type SplitterCancellationsParams = {
  title: string
  startIso: string
  /** Data da última massiva do splitter (ISO) para correlação pós-evento. */
  eventAt?: string | null
  windowDays?: number
}

/**
 * Cancelamentos de um único splitter (por título, do JSON da Voalle). Usa localBffUrl +
 * sessão como as demais chamadas ao BFF. 503 → resposta vazia (banco indisponível).
 */
export async function fetchSplitterCancellations(
  params: SplitterCancellationsParams,
): Promise<SplitterCancellations> {
  const search = new URLSearchParams({ title: params.title, start: params.startIso })
  if (params.eventAt) search.set('eventAt', params.eventAt)
  if (params.windowDays) search.set('windowDays', String(params.windowDays))

  const url = `${env.localBffUrl}/api/cancellations/by-splitter?${search.toString()}`
  const res = await fetchWithSessionAuth(url)
  if (res.status === 503) return EMPTY_SPLITTER_CANCELLATIONS
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse
  if (!json.success) throw new Error('API retornou success=false')
  return json.data
}
