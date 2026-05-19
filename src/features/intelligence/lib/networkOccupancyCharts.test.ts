import { describe, expect, it } from 'vitest'
import {
  buildDeltaDistributionHistogram,
  buildOccupancyTimeSeries,
} from '@/features/intelligence/lib/networkOccupancyCharts'

describe('networkOccupancyCharts', () => {
  it('builds time series with critical and attention share', () => {
    const now = new Date(2026, 4, 19, 12, 0, 0)
    const series = buildOccupancyTimeSeries([
      {
        capturedAt: now,
        currentUsagePercent: 100,
        delta7d: 0,
        delta30d: 0,
      },
      {
        capturedAt: now,
        currentUsagePercent: 80,
        delta7d: 0,
        delta30d: 0,
      },
      {
        capturedAt: now,
        currentUsagePercent: 50,
        delta7d: 0,
        delta30d: 0,
      },
    ])
    const last = series[series.length - 1]
    expect(last?.averageUsagePercent).toBeCloseTo(76.67, 1)
    expect(last?.criticalSharePercent).toBeCloseTo(33.33, 1)
    expect(last?.attentionSharePercent).toBeCloseTo(33.33, 1)
  })

  it('builds delta histogram from current row deltas', () => {
    const hist = buildDeltaDistributionHistogram(
      [
        { capturedAt: new Date(), currentUsagePercent: 50, delta7d: 0, delta30d: 6 },
        { capturedAt: new Date(), currentUsagePercent: 80, delta7d: 4, delta30d: 0 },
        { capturedAt: new Date(), currentUsagePercent: 98, delta7d: -6, delta30d: 0 },
      ],
      '7d',
    )
    expect(hist.find((b) => b.key === 'estavel')?.count).toBe(1)
    expect(hist.find((b) => b.key === 'subindo')?.count).toBe(1)
    expect(hist.find((b) => b.key === 'queda-forte')?.count).toBe(1)
  })
})
