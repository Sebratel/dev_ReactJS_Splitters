import type { TrendDeltaReference, TrendRowForHighlight } from '@/features/intelligence/lib/trendStatusHighlights'
import { selectedDeltaForTrend } from '@/features/intelligence/lib/trendStatusHighlights'

export const TREND_NEAR_LIMIT_USAGE_PERCENT = 90
export const TREND_RISING_DELTA_THRESHOLD_PP = 3

export type TrendStatusCapacityGroups = {
  nearLimit: TrendRowForHighlight[]
  rising: TrendRowForHighlight[]
  labelCounts: {
    Estavel: number
    'Em crescimento': number
    'Em queda': number
    'Quase saturando': number
  }
  totalWithTrend: number
}

function labelPriority(label: string): number {
  if (label === 'Quase saturando') return 4
  if (label === 'Em crescimento') return 3
  if (label === 'Em queda') return 2
  if (label === 'Estavel') return 0
  return 1
}

function isRisingRow(row: TrendRowForHighlight, reference: TrendDeltaReference): boolean {
  if (row.label !== 'Estavel') return true
  return Math.abs(selectedDeltaForTrend(row, reference)) >= TREND_RISING_DELTA_THRESHOLD_PP
}

export function buildTrendStatusCapacityGroups(
  trends: readonly TrendRowForHighlight[],
  reference: TrendDeltaReference,
  limits: { nearLimit?: number; rising?: number } = {},
): TrendStatusCapacityGroups {
  const nearLimitLimit = limits.nearLimit ?? 5
  const risingLimit = limits.rising ?? 5

  const labelCounts = {
    Estavel: 0,
    'Em crescimento': 0,
    'Em queda': 0,
    'Quase saturando': 0,
  }

  for (const row of trends) {
    if (row.label === 'Em crescimento') labelCounts['Em crescimento'] += 1
    else if (row.label === 'Em queda') labelCounts['Em queda'] += 1
    else if (row.label === 'Quase saturando') labelCounts['Quase saturando'] += 1
    else labelCounts.Estavel += 1
  }

  const nearLimit = [...trends]
    .filter((row) => row.currentUsagePercent >= TREND_NEAR_LIMIT_USAGE_PERCENT)
    .sort((a, b) => b.currentUsagePercent - a.currentUsagePercent)
    .slice(0, nearLimitLimit)

  const deltaKey = reference === '7d' ? 'delta7d' : 'delta30d'
  const rising = [...trends]
    .filter((row) => isRisingRow(row, reference))
    .sort((a, b) => {
      const byLabel = labelPriority(b.label) - labelPriority(a.label)
      if (byLabel !== 0) return byLabel
      const byAbsDelta = Math.abs(b[deltaKey]) - Math.abs(a[deltaKey])
      if (byAbsDelta !== 0) return byAbsDelta
      return b.currentUsagePercent - a.currentUsagePercent
    })
    .slice(0, risingLimit)

  return {
    nearLimit,
    rising,
    labelCounts,
    totalWithTrend: trends.length,
  }
}
