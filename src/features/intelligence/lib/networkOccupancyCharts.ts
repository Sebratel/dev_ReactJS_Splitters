export type TrendRowForOccupancyCharts = {
  capturedAt: Date | null
  currentUsagePercent: number
  delta7d: number
  delta30d: number
}

export type TrendDeltaReference = '7d' | '30d'

export type OccupancyTimeSeriesPoint = {
  at: Date
  averageUsagePercent: number
  criticalSharePercent: number
  attentionSharePercent: number
  sampleCount: number
}

export type DeltaDistributionBucketKey =
  | 'queda-forte'
  | 'queda'
  | 'estavel'
  | 'subindo'
  | 'subindo-forte'

export type DeltaDistributionBucket = {
  key: DeltaDistributionBucketKey
  label: string
  count: number
}

export const DELTA_DISTRIBUTION_COLORS: Record<DeltaDistributionBucketKey, string> = {
  'queda-forte': '#06b6d4',
  queda: '#0ea5e9',
  estavel: '#94a3b8',
  subindo: '#f59e0b',
  'subindo-forte': '#ea580c',
}

const CRITICAL_USAGE_PERCENT = 95
const ATTENTION_USAGE_MIN_PERCENT = 70

const DELTA_STABLE_THRESHOLD = 3
const DELTA_STRONG_THRESHOLD = 5

function startOfDay(date: Date): Date {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function isAttentionUsage(usagePercent: number): boolean {
  return (
    usagePercent >= ATTENTION_USAGE_MIN_PERCENT && usagePercent < CRITICAL_USAGE_PERCENT
  )
}

/** Mesma estimativa do gráfico de área: hoje, −7d e −30d por splitter com tendência. */
export function collectEstimatedUsagePoints(
  trends: readonly TrendRowForOccupancyCharts[],
): Array<{ at: Date; usagePercent: number }> {
  const points: Array<{ at: Date; usagePercent: number }> = []

  for (const row of trends) {
    if (!row.capturedAt) continue
    const atNow = row.capturedAt
    const at7d = new Date(atNow)
    at7d.setDate(at7d.getDate() - 7)
    const at30d = new Date(atNow)
    at30d.setDate(at30d.getDate() - 30)

    points.push(
      { at: at30d, usagePercent: row.currentUsagePercent - row.delta30d },
      { at: at7d, usagePercent: row.currentUsagePercent - row.delta7d },
      { at: atNow, usagePercent: row.currentUsagePercent },
    )
  }

  return points
}

export function buildOccupancyTimeSeries(
  trends: readonly TrendRowForOccupancyCharts[],
): OccupancyTimeSeriesPoint[] {
  const points = collectEstimatedUsagePoints(trends)
  if (points.length === 0) return []

  const bucket = new Map<
    string,
    {
      at: Date
      sum: number
      count: number
      criticalCount: number
      attentionCount: number
    }
  >()

  for (const point of points) {
    const key = point.at.toISOString().slice(0, 10)
    const current = bucket.get(key) ?? {
      at: startOfDay(point.at),
      sum: 0,
      count: 0,
      criticalCount: 0,
      attentionCount: 0,
    }
    current.sum += point.usagePercent
    current.count += 1
    if (point.usagePercent >= CRITICAL_USAGE_PERCENT) current.criticalCount += 1
    else if (isAttentionUsage(point.usagePercent)) current.attentionCount += 1
    bucket.set(key, current)
  }

  return [...bucket.values()]
    .map((entry) => ({
      at: entry.at,
      averageUsagePercent: Number((entry.sum / Math.max(1, entry.count)).toFixed(2)),
      criticalSharePercent: Number(
        ((entry.criticalCount / Math.max(1, entry.count)) * 100).toFixed(2),
      ),
      attentionSharePercent: Number(
        ((entry.attentionCount / Math.max(1, entry.count)) * 100).toFixed(2),
      ),
      sampleCount: entry.count,
    }))
    .sort((a, b) => a.at.getTime() - b.at.getTime())
}

function deltaBucketKey(delta: number): DeltaDistributionBucketKey {
  if (delta <= -DELTA_STRONG_THRESHOLD) return 'queda-forte'
  if (delta < -DELTA_STABLE_THRESHOLD) return 'queda'
  if (delta <= DELTA_STABLE_THRESHOLD) return 'estavel'
  if (delta <= DELTA_STRONG_THRESHOLD) return 'subindo'
  return 'subindo-forte'
}

export function selectedDeltaForOccupancyRow(
  row: Pick<TrendRowForOccupancyCharts, 'delta7d' | 'delta30d'>,
  reference: TrendDeltaReference,
): number {
  return reference === '7d' ? row.delta7d : row.delta30d
}

/** Quantos equipamentos em cada faixa de variação de ocupação (Δ do período de referência). */
export function buildDeltaDistributionHistogram(
  trends: readonly TrendRowForOccupancyCharts[],
  reference: TrendDeltaReference,
): DeltaDistributionBucket[] {
  const counts: Record<DeltaDistributionBucketKey, number> = {
    'queda-forte': 0,
    queda: 0,
    estavel: 0,
    subindo: 0,
    'subindo-forte': 0,
  }

  for (const row of trends) {
    if (!row.capturedAt) continue
    const delta = selectedDeltaForOccupancyRow(row, reference)
    counts[deltaBucketKey(delta)] += 1
  }

  const suffix = reference === '7d' ? ' (7 dias)' : ' (30 dias)'

  const buckets: DeltaDistributionBucket[] = [
    {
      key: 'queda-forte',
      label: `≤ −${DELTA_STRONG_THRESHOLD} pp${suffix}`,
      count: counts['queda-forte'],
    },
    {
      key: 'queda',
      label: `−${DELTA_STRONG_THRESHOLD} a −${DELTA_STABLE_THRESHOLD} pp${suffix}`,
      count: counts.queda,
    },
    {
      key: 'estavel',
      label: `−${DELTA_STABLE_THRESHOLD} a +${DELTA_STABLE_THRESHOLD} pp${suffix}`,
      count: counts.estavel,
    },
    {
      key: 'subindo',
      label: `+${DELTA_STABLE_THRESHOLD} a +${DELTA_STRONG_THRESHOLD} pp${suffix}`,
      count: counts.subindo,
    },
    {
      key: 'subindo-forte',
      label: `> +${DELTA_STRONG_THRESHOLD} pp${suffix}`,
      count: counts['subindo-forte'],
    },
  ]

  return buckets
}
