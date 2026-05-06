import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'
import type { SplitterTrend } from '@/features/splitters/model/splitterTrend'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type TrendApiRow = {
  splitterCode?: unknown
  label?: unknown
  currentUsagePercent?: unknown
  delta7d?: unknown
  delta30d?: unknown
  capturedAt?: unknown
}

type MassivaApiRow = {
  splitterCode?: unknown
  totalTickets?: unknown
  openTickets?: unknown
  closedTickets?: unknown
  affectedClientsTotal?: unknown
  latestOpenedAt?: unknown
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (text === '') return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

/** Um GET por lote: tendências + massivas (menos roundtrips que dois endpoints separados). */
export async function fetchSplitterIntelligenceBatchFromLocalDb(
  splitterCodes: readonly string[],
  /** Filtra agregados de massiva por `opened_at` no BFF (painel / período). */
  massivaOpenedRange?: { start: Date; end: Date },
): Promise<{ trends: Map<string, SplitterTrend>; massiva: Map<string, SplitterMassivaStats> }> {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) {
    return { trends: new Map(), massiva: new Map() }
  }

  const params = new URLSearchParams({ codes: clean.join(',') })
  if (massivaOpenedRange) {
    params.set('from', massivaOpenedRange.start.toISOString())
    params.set('to', massivaOpenedRange.end.toISOString())
  }
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/splitters/intelligence-batch?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar lote de inteligência de splitters no BFF: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.trends) || !Array.isArray(parsed.massiva)) {
    throw new Error('Formato de resposta inesperado no lote de inteligência de splitters.')
  }

  const trends = new Map<string, SplitterTrend>()
  for (const row of parsed.trends as TrendApiRow[]) {
    const code = String(row.splitterCode ?? '').trim()
    if (code === '') continue
    trends.set(code, {
      label: String(row.label ?? 'Estavel').trim() || 'Estavel',
      currentUsagePercent: toNumber(row.currentUsagePercent),
      delta7d: toNumber(row.delta7d),
      delta30d: toNumber(row.delta30d),
      capturedAt: toNullableDate(row.capturedAt),
    })
  }

  const massiva = new Map<string, SplitterMassivaStats>()
  for (const row of parsed.massiva as MassivaApiRow[]) {
    const code = String(row.splitterCode ?? '').trim()
    if (code === '') continue
    massiva.set(code, {
      totalTickets: toNumber(row.totalTickets),
      openTickets: toNumber(row.openTickets),
      closedTickets: toNumber(row.closedTickets),
      affectedClientsTotal: toNumber(row.affectedClientsTotal),
      latestOpenedAt: toNullableDate(row.latestOpenedAt),
    })
  }

  return { trends, massiva }
}
