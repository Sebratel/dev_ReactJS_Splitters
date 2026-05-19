import { describe, expect, it } from 'vitest'
import {
  countDistinctMassivasByLifecycleBucket,
  toLifecycleBucket,
} from '@/features/massiva/lib/lifecycleMassivaBuckets'

describe('lifecycleMassivaBuckets', () => {
  it('maps age to bucket', () => {
    expect(toLifecycleBucket(0.5)).toBe('0-1')
    expect(toLifecycleBucket(2)).toBe('1-3')
    expect(toLifecycleBucket(4)).toBe('3-5')
    expect(toLifecycleBucket(6)).toBe('5+')
  })

  it('counts distinct massivas per bucket without double-counting within bucket', () => {
    const codeToBucket = new Map([
      ['A', '0-1' as const],
      ['B', '0-1' as const],
      ['C', '5+' as const],
    ])
    const counts = countDistinctMassivasByLifecycleBucket(
      [
        { massivaHistoryId: 1, splitterCodes: ['A', 'B'] },
        { massivaHistoryId: 2, splitterCodes: ['C'] },
        { massivaHistoryId: 3, splitterCodes: ['A', 'C'] },
      ],
      codeToBucket,
    )
    expect(counts['0-1']).toBe(2)
    expect(counts['5+']).toBe(2)
    expect(counts['1-3']).toBe(0)
  })
})
