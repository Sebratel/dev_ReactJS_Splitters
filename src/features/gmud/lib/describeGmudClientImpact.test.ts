import { describe, expect, it } from 'vitest'
import { describeGmudClientImpact, formatNaiveShort } from '@/features/gmud/lib/describeGmudClientImpact'

describe('formatNaiveShort', () => {
  it('formata sem converter fuso', () => {
    expect(formatNaiveShort('2026-11-20 05:00:00')).toBe('20/11 05:00')
    expect(formatNaiveShort('2026-11-20T05:00:00')).toBe('20/11 05:00')
  })
  it('valor ausente ou inválido vira traço', () => {
    expect(formatNaiveShort(null)).toBe('—')
    expect(formatNaiveShort('x')).toBe('—')
  })
})

describe('describeGmudClientImpact', () => {
  it('estimativa avisa que ainda não entrou', () => {
    expect(describeGmudClientImpact({ applicable: true, source: 'estimativa', total: 10 })).toMatch(/Estimativa pelo escopo/)
  })
  it('incluída mostra desde quando e até quando', () => {
    const t = describeGmudClientImpact({ applicable: true, source: 'historico', status: 'incluida', includedAt: '2026-11-20 02:00:00', windowEnd: '2026-11-20 05:00:00' })
    expect(t).toContain('20/11 02:00')
    expect(t).toContain('20/11 05:00')
  })
  it('removida explica o motivo', () => {
    const t = describeGmudClientImpact({ applicable: true, source: 'historico', status: 'removida', removedAt: '2026-11-20 05:00:00', removedReason: 'fora_da_janela' })
    expect(t).toContain('a janela terminou')
  })
  it('erro de estimativa aparece', () => {
    expect(describeGmudClientImpact({ applicable: true, erro: 'sem POP/Site' })).toContain('sem POP/Site')
  })
})
