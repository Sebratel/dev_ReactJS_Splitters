import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type SplitterMaintenanceStats = {
  totalMaintenances: number
  uniqueProtocols: number
  uniqueClients: number
  openMaintenances: number
  rompimentoCount: number
  trocaFlatCount: number
  latestCreatedAt: Date | null
}

type SplitterMaintenanceApiRow = {
  splitterCode?: unknown
  totalMaintenances?: unknown
  uniqueProtocols?: unknown
  uniqueClients?: unknown
  openMaintenances?: unknown
  rompimentoCount?: unknown
  trocaFlatCount?: unknown
  latestCreatedAt?: unknown
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toNullableDate(value: unknown): Date | null {
  if (value == null) return null
  const txt = String(value).trim()
  if (txt === '') return null
  const d = new Date(txt)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function fetchSplitterMaintenanceStatsFromLocalDb(
  splitterCodes: readonly string[],
  start: Date,
  end: Date,
): Promise<Map<string, SplitterMaintenanceStats>> {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return new Map()

  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
    splitterCodes: clean.join(','),
  })
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/intelligence/maintenance-by-splitter?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar manutenção por splitter no BFF local: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !parsed.data || !Array.isArray(parsed.data.rows)) {
    throw new Error('Formato inesperado ao consultar manutenção por splitter.')
  }

  const byCode = new Map<string, SplitterMaintenanceStats>()
  for (const row of parsed.data.rows as SplitterMaintenanceApiRow[]) {
    const code = String(row.splitterCode ?? '').trim()
    if (code === '' || code === 'SEM_MAPEAMENTO') continue
    byCode.set(code, {
      totalMaintenances: toNumber(row.totalMaintenances),
      uniqueProtocols: toNumber(row.uniqueProtocols),
      uniqueClients: toNumber(row.uniqueClients),
      openMaintenances: toNumber(row.openMaintenances),
      rompimentoCount: toNumber(row.rompimentoCount),
      trocaFlatCount: toNumber(row.trocaFlatCount),
      latestCreatedAt: toNullableDate(row.latestCreatedAt),
    })
  }

  return byCode
}
