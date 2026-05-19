import { describe, expect, it } from 'vitest'
import { buildTrendStatusCapacityGroups } from '@/features/intelligence/lib/trendStatusCapacityGroups'
import type { TrendRowForHighlight } from '@/features/intelligence/lib/trendStatusHighlights'

function row(
  code: string,
  usage: number,
  d7: number,
  label = 'Estavel',
): TrendRowForHighlight {
  return {
    splitterCode: code,
    splitterTitle: code,
    label,
    currentUsagePercent: usage,
    delta7d: d7,
    delta30d: d7,
  }
}

describe('buildTrendStatusCapacityGroups', () => {
  it('splits near limit and rising', () => {
    const groups = buildTrendStatusCapacityGroups(
      [
        row('HIGH', 96, 0),
        row('RISE', 70, 5, 'Em crescimento'),
        row('OK', 50, 0),
      ],
      '7d',
    )
    expect(groups.nearLimit.map((r) => r.splitterCode)).toEqual(['HIGH'])
    expect(groups.rising.map((r) => r.splitterCode)).toEqual(['RISE'])
    expect(groups.labelCounts['Em crescimento']).toBe(1)
  })

  it('includes high usage even when delta is zero', () => {
    const groups = buildTrendStatusCapacityGroups([row('A', 92, 0)], '7d')
    expect(groups.nearLimit).toHaveLength(1)
    expect(groups.rising).toHaveLength(0)
  })
})
