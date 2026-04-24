import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatOperationalRelativeDate } from '@/features/splitters/lib/formatOperationalDate'

describe('formatOperationalRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('null, hoje, dias, meses e anos', () => {
    expect(formatOperationalRelativeDate(null)).toBe('Sem registro')
    expect(formatOperationalRelativeDate(new Date('2026-06-15T10:00:00.000Z'))).toBe(
      'Hoje',
    )
    expect(formatOperationalRelativeDate(new Date('2026-06-13T12:00:00.000Z'))).toBe(
      'Ha 2 dias',
    )
    expect(formatOperationalRelativeDate(new Date('2026-05-15T12:00:00.000Z'))).toBe(
      'Ha 1 mes',
    )
    expect(formatOperationalRelativeDate(new Date('2025-06-15T12:00:00.000Z'))).toBe(
      'Ha 1 ano',
    )
  })
})
