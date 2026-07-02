import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import {
  EMPTY_ACTIVE_BASE,
  EMPTY_MASSIVA_IMPACT,
  type CancellationsActiveBase,
  type MassivaImpact,
} from '@/features/cancellations/model/cancellationsExtras'

/** Base ativa por local — muda devagar, cache longo no BFF. */
export async function fetchCancellationsActiveBase(): Promise<CancellationsActiveBase> {
  const url = `${env.localBffUrl}/api/cancellations/active-base`
  const res = await fetchWithSessionAuth(url)
  if (res.status === 503) return EMPTY_ACTIVE_BASE
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { success: boolean; data: CancellationsActiveBase }
  if (!json.success) throw new Error('API retornou success=false')
  return json.data
}

/** Ranking de áreas/condomínios em risco (massiva → churn de rede). */
export async function fetchMassivaImpact(
  startIso: string,
  windowDays = 30,
): Promise<MassivaImpact> {
  const search = new URLSearchParams({ start: startIso, windowDays: String(windowDays) })
  const url = `${env.localBffUrl}/api/cancellations/massiva-impact?${search.toString()}`
  const res = await fetchWithSessionAuth(url)
  if (res.status === 503) return EMPTY_MASSIVA_IMPACT
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as { success: boolean; data: MassivaImpact }
  if (!json.success) throw new Error('API retornou success=false')
  return json.data
}
