import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { OnuSplitterSignalSummary } from '@/features/onu/model/onuSplitterSummary'

type ApiResponse = {
  success: boolean
  data: Record<string, OnuSplitterSignalSummary>
}

export async function fetchOnuSummaryBySplitter(): Promise<Map<string, OnuSplitterSignalSummary>> {
  // Usa localBffUrl + sessão como as demais chamadas ONU. Com fetch relativo, no
  // deploy a rota /api caía no fallback do SPA (index.html) e o parse quebrava.
  const url = `${env.localBffUrl}/api/onu-diagnostics/summary-by-splitter`
  const res = await fetchWithSessionAuth(url)
  if (res.status === 503) return new Map()
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse
  if (!json.success) throw new Error('API retornou success=false')
  return new Map(Object.entries(json.data))
}
