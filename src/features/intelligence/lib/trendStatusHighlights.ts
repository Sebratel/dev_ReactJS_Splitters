export type TrendRowForHighlight = {
  splitterCode: string
  splitterTitle: string
  label: string
  currentUsagePercent: number
  delta7d: number
  delta30d: number
}

export type TrendDeltaReference = '7d' | '30d'

function labelPriority(label: string): number {
  if (label === 'Quase saturando') return 4
  if (label === 'Em crescimento') return 3
  if (label === 'Em queda') return 2
  if (label === 'Estavel') return 0
  return 1
}

export function selectedDeltaForTrend(
  row: Pick<TrendRowForHighlight, 'delta7d' | 'delta30d'>,
  reference: TrendDeltaReference,
): number {
  return reference === '7d' ? row.delta7d : row.delta30d
}

/** Destaques operacionais: não é ordem do catálogo — prioriza alerta, |Δ| e ocupação. */
export function pickTrendStatusHighlights(
  trends: readonly TrendRowForHighlight[],
  reference: TrendDeltaReference,
  limit = 8,
): TrendRowForHighlight[] {
  const deltaKey = reference === '7d' ? 'delta7d' : 'delta30d'

  return [...trends]
    .sort((a, b) => {
      const byLabel = labelPriority(b.label) - labelPriority(a.label)
      if (byLabel !== 0) return byLabel

      const byAbsDelta = Math.abs(b[deltaKey]) - Math.abs(a[deltaKey])
      if (byAbsDelta !== 0) return byAbsDelta

      return b.currentUsagePercent - a.currentUsagePercent
    })
    .slice(0, Math.max(0, limit))
}

export function allTrendHighlightsHaveZeroDelta(
  rows: readonly TrendRowForHighlight[],
  reference: TrendDeltaReference,
): boolean {
  if (rows.length === 0) return false
  return rows.every((row) => selectedDeltaForTrend(row, reference) === 0)
}
