import { describe, expect, it } from 'vitest'
import {
  buildMassivaDayShiftRecurrenceFromOpenedAt,
  buildMassivaDayShiftRecurrenceFromSplitterLatestOpenedAt,
  bucketMassivaOpenedAt,
} from '@/features/intelligence/lib/massivaDayShiftRecurrence'

describe('massivaDayShiftRecurrence', () => {
  it('buckets opened_at into weekday and shift', () => {
    const d = new Date(2026, 4, 19, 20, 30, 0) // Terça 20:30 local
    expect(bucketMassivaOpenedAt(d).weekday).toBe('Ter')
    expect(bucketMassivaOpenedAt(d).shift).toBe('Noite')
  })

  it('counts distinct massivas not splitters', () => {
    const tuesdayNight = new Date(2026, 4, 19, 21, 0, 0)
    const cells = buildMassivaDayShiftRecurrenceFromOpenedAt([
      tuesdayNight,
      tuesdayNight,
      tuesdayNight,
    ])
    const terNoi = cells.find((c) => c.weekday === 'Ter' && c.shift === 'Noite')
    expect(terNoi?.count).toBe(3)
  })

  it('splitter-based logic inflates when many splitters share one opening', () => {
    const tuesdayNight = new Date(2026, 4, 19, 21, 0, 0)
    const splitterRows = Array.from({ length: 527 }, () => ({
      latestOpenedAt: tuesdayNight,
    }))
    const inflated = buildMassivaDayShiftRecurrenceFromSplitterLatestOpenedAt(splitterRows)
    const terNoi = inflated.find((c) => c.weekday === 'Ter' && c.shift === 'Noite')
    expect(terNoi?.count).toBe(527)

    const correct = buildMassivaDayShiftRecurrenceFromOpenedAt([tuesdayNight])
    const terNoiCorrect = correct.find((c) => c.weekday === 'Ter' && c.shift === 'Noite')
    expect(terNoiCorrect?.count).toBe(1)
  })
})
