import { describe, expect, it } from 'vitest'
import { mergeIntelligenceMassivaPeriodRollup } from '@/features/massiva/lib/mergeIntelligenceMassivaPeriodRollup'

describe('mergeIntelligenceMassivaPeriodRollup', () => {
  it('mantém total do MySQL no período e reduz abertas com Elleven', () => {
    const merged = mergeIntelligenceMassivaPeriodRollup(
      {
        distinctMassivaCount: 186,
        affectedClientsDistinctSum: 42_150,
        openMassivasCount: 45,
        closedMassivasCount: 141,
      },
      {
        distinctMassivaCount: 18,
        affectedClientsDistinctSum: 500,
        openMassivasCount: 12,
        closedMassivasCount: 6,
      },
    )
    expect(merged.distinctMassivaCount).toBe(186)
    expect(merged.affectedClientsDistinctSum).toBe(42_150)
    expect(merged.openMassivasCount).toBe(12)
    expect(merged.closedMassivasCount).toBe(174)
  })

  it('sem MySQL usa só Elleven', () => {
    const merged = mergeIntelligenceMassivaPeriodRollup(
      {
        distinctMassivaCount: 0,
        affectedClientsDistinctSum: 0,
        openMassivasCount: 0,
        closedMassivasCount: 0,
      },
      {
        distinctMassivaCount: 18,
        affectedClientsDistinctSum: 100,
        openMassivasCount: 5,
        closedMassivasCount: 13,
      },
    )
    expect(merged.distinctMassivaCount).toBe(18)
  })
})
