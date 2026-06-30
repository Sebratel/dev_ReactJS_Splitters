import type { OnuSplitterSignalSummary } from '@/features/onu/model/onuSplitterSummary'

type ApiResponse = {
  success: boolean
  data: Record<string, OnuSplitterSignalSummary>
}

export async function fetchOnuSummaryBySplitter(): Promise<Map<string, OnuSplitterSignalSummary>> {
  const res = await fetch('/api/onu-diagnostics/summary-by-splitter')
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = (await res.json()) as ApiResponse
  if (!json.success) throw new Error('API retornou success=false')
  return new Map(Object.entries(json.data))
}
