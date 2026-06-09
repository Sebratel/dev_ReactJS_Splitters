import { describe, expect, it } from 'vitest'
import { formatMassivaRoutePairsSummary } from '@/features/massiva/lib/formatMassivaRoutePairsSummary'

describe('formatMassivaRoutePairsSummary', () => {
  it('um par usa formato slot / PON', () => {
    expect(formatMassivaRoutePairsSummary([{ slot: 3, port: 4 }])).toEqual({
      display: 'Slot 3 / PON 4',
      full: 'Slot 3 / PON 4',
    })
  })

  it('vários pares agrupa por slot', () => {
    const out = formatMassivaRoutePairsSummary([
      { slot: 1, port: 1 },
      { slot: 1, port: 2 },
      { slot: 3, port: 4 },
      { slot: 3, port: 5 },
    ])
    expect(out.full).toBe('Slot 1: 1, 2 · Slot 3: 4, 5 (4 combinações)')
    expect(out.display).toContain('Slot 1: 1, 2')
    expect(out.display).toContain('Slot 3: 4, 5')
    expect(out.display).toContain('4 comb.')
  })

  it('trunca slots extras no display', () => {
    const out = formatMassivaRoutePairsSummary(
      [
        { slot: 1, port: 1 },
        { slot: 2, port: 1 },
        { slot: 3, port: 1 },
      ],
      { maxSlotsInDisplay: 2 },
    )
    expect(out.display).toContain('+1 slot(s)')
    expect(out.full).toContain('Slot 3: 1')
  })
})
