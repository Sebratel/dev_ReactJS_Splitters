import { describe, expect, it } from 'vitest'
import {
  formatDeltaPp,
  usageDeltaExample,
} from '@/features/intelligence/lib/percentagePointsHelp'

describe('percentagePointsHelp', () => {
  it('formats signed pp', () => {
    expect(formatDeltaPp(3.5)).toBe('+3.50 pp')
    expect(formatDeltaPp(-2)).toBe('-2.00 pp')
  })

  it('builds before/after example', () => {
    expect(usageDeltaExample(78, 8)).toBe('70% → 78%')
  })
})
