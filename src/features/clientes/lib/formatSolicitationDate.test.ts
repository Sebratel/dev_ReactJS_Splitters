import { describe, expect, it } from 'vitest'
import { formatSolicitationDateDisplay } from '@/features/clientes/lib/formatSolicitationDate'

describe('formatSolicitationDateDisplay', () => {
  it('formata data válida e trata null / inválida', () => {
    const d = new Date('2026-03-05T14:07:00.000Z')
    expect(formatSolicitationDateDisplay(d)).toMatch(
      /^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/,
    )
    expect(formatSolicitationDateDisplay(null)).toBe('—')
    expect(formatSolicitationDateDisplay(new Date(Number.NaN))).toBe('—')
  })
})
