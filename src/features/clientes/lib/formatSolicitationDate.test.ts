import { describe, expect, it } from 'vitest'
import { formatSolicitationDateDisplay } from '@/features/clientes/lib/formatSolicitationDate'

describe('formatSolicitationDateDisplay', () => {
  it('formata data válida e trata null / inválida', () => {
    const d = new Date('2026-03-05T14:07:00.000Z')
    const formatted = formatSolicitationDateDisplay(d)
    // pt-BR via Intl pode separar data/hora por vírgula ou espaço (varia conforme runtime)
    expect(formatted).toMatch(/05\/03\/2026/)
    expect(formatted).toMatch(/11:07/)
    expect(formatSolicitationDateDisplay(null)).toBe('—')
    expect(formatSolicitationDateDisplay(new Date(Number.NaN))).toBe('—')
  })
})
