import { describe, expect, it } from 'vitest'
import {
  allTrendHighlightsHaveZeroDelta,
  pickTrendStatusHighlights,
} from '@/features/intelligence/lib/trendStatusHighlights'

function row(
  code: string,
  label: string,
  usage: number,
  d7: number,
  d30 = 0,
): Parameters<typeof pickTrendStatusHighlights>[0][number] {
  return {
    splitterCode: code,
    splitterTitle: code,
    label,
    currentUsagePercent: usage,
    delta7d: d7,
    delta30d: d30,
  }
}

describe('pickTrendStatusHighlights', () => {
  it('prioritizes non-stable and larger absolute delta', () => {
    const picked = pickTrendStatusHighlights(
      [
        row('A', 'Estavel', 50, 0),
        row('B', 'Em crescimento', 70, 4),
        row('C', 'Estavel', 90, 0.5),
        row('D', 'Em queda', 60, -3.5),
      ],
      '7d',
      2,
    )
    expect(picked.map((r) => r.splitterCode)).toEqual(['B', 'D'])
  })

  it('detects all-zero delta highlights', () => {
    const picked = pickTrendStatusHighlights([row('A', 'Estavel', 50, 0), row('B', 'Estavel', 40, 0)], '7d')
    expect(allTrendHighlightsHaveZeroDelta(picked, '7d')).toBe(true)
  })
})
