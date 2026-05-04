import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type MaintenanceBySplitterRow = {
  splitterCode: string
  splitterTitle: string
  accessPointCode: string
  totalMaintenances: number
  uniqueProtocols: number
  uniqueClients: number
  openMaintenances: number
  rompimentoCount: number
  trocaFlatCount: number
  latestCreatedAt: Date | null
}

export type MaintenanceBySplitterTotals = {
  totalMaintenances: number
  totalProtocols: number
  totalClients: number
  openMaintenances: number
  splittersWithMaintenances: number
  unmappedMaintenances: number
}

export type MaintenanceBySplitterResponse = {
  rows: MaintenanceBySplitterRow[]
  totals: MaintenanceBySplitterTotals
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toText(value: unknown): string {
  if (value == null) return ''
  return String(value).trim()
}

function toNullableDate(value: unknown): Date | null {
  const txt = toText(value)
  if (txt === '') return null
  const d = new Date(txt)
  return Number.isNaN(d.getTime()) ? null : d
}

export async function fetchMaintenanceBySplitter(
  start: Date,
  end: Date,
): Promise<MaintenanceBySplitterResponse> {
  const params = new URLSearchParams({
    start: start.toISOString(),
    end: end.toISOString(),
  })
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/intelligence/maintenance-by-splitter?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar manutenções por splitter no BFF Local: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || parsed.data == null || !Array.isArray(parsed.data.rows)) {
    throw new Error('Formato de resposta inesperado ao consultar manutenções por splitter.')
  }

  const rows: MaintenanceBySplitterRow[] = parsed.data.rows.map((row: Record<string, unknown>) => ({
    splitterCode: toText(row.splitterCode),
    splitterTitle: toText(row.splitterTitle),
    accessPointCode: toText(row.accessPointCode),
    totalMaintenances: toNumber(row.totalMaintenances),
    uniqueProtocols: toNumber(row.uniqueProtocols),
    uniqueClients: toNumber(row.uniqueClients),
    openMaintenances: toNumber(row.openMaintenances),
    rompimentoCount: toNumber(row.rompimentoCount),
    trocaFlatCount: toNumber(row.trocaFlatCount),
    latestCreatedAt: toNullableDate(row.latestCreatedAt),
  }))

  const totalsRaw = parsed.data.totals as Record<string, unknown> | undefined
  return {
    rows,
    totals: {
      totalMaintenances: toNumber(totalsRaw?.totalMaintenances),
      totalProtocols: toNumber(totalsRaw?.totalProtocols),
      totalClients: toNumber(totalsRaw?.totalClients),
      openMaintenances: toNumber(totalsRaw?.openMaintenances),
      splittersWithMaintenances: toNumber(totalsRaw?.splittersWithMaintenances),
      unmappedMaintenances: toNumber(totalsRaw?.unmappedMaintenances),
    },
  }
}
