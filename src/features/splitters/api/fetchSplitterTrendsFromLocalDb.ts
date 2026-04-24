import type { SplitterTrend } from '@/features/splitters/model/splitterTrend'
import { env } from '@/shared/config/env'

type SplitterTrendApiRow = {
  splitterCode?: unknown
  label?: unknown
  currentUsagePercent?: unknown
  delta7d?: unknown
  delta30d?: unknown
  capturedAt?: unknown
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

export async function fetchSplitterTrendsFromLocalDb(
  splitterCodes: readonly string[],
): Promise<Map<string, SplitterTrend>> {
  const clean = [...new Set(splitterCodes.map((code) => String(code ?? '').trim()).filter(Boolean))]
  if (clean.length === 0) return new Map()

  const params = new URLSearchParams({
    codes: clean.join(','),
  })

  const response = await fetch(`${env.localBffUrl}/api/splitters/trends?${params}`)
  if (!response.ok) {
    throw new Error(`Erro ao consultar tendências de splitters no BFF Local: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar tendências de splitters.')
  }

  const byCode = new Map<string, SplitterTrend>()
  for (const row of parsed.data as SplitterTrendApiRow[]) {
    const code = String(row.splitterCode ?? '').trim()
    if (code === '') continue
    byCode.set(code, {
      label: String(row.label ?? 'Estavel').trim() || 'Estavel',
      currentUsagePercent: toNumber(row.currentUsagePercent),
      delta7d: toNumber(row.delta7d),
      delta30d: toNumber(row.delta30d),
      capturedAt: toNullableDate(row.capturedAt),
    })
  }

  return byCode
}
