import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'
import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

type SplitterMassivaStatsApiRow = {
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

export async function fetchSplitterMassivaStatsFromLocalDb(
  splitterCodes: readonly string[],
): Promise<Map<string, SplitterMassivaStats>> {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return new Map()

  const params = new URLSearchParams({
    splitterCodes: clean.join(','),
  })

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/splitter-stats?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar histórico local de massivas por splitter: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar histórico local de massivas.')
  }

  const byCode = new Map<string, SplitterMassivaStats>()
  for (const row of parsed.data as SplitterMassivaStatsApiRow[]) {
    const code = String(row.splitterCode ?? '').trim()
    if (code === '') continue
    byCode.set(code, {
      totalTickets: toNumber(row.totalTickets),
      openTickets: toNumber(row.openTickets),
      closedTickets: toNumber(row.closedTickets),
      affectedClientsTotal: toNumber(row.affectedClientsTotal),
      latestOpenedAt: toNullableDate(row.latestOpenedAt),
    })
  }

  return byCode
}
