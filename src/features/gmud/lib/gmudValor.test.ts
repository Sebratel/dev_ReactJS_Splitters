import { describe, expect, it } from 'vitest'
import { formatValorInvestido, maskValorInvestido } from '@/features/gmud/lib/gmudValor'

describe('maskValorInvestido', () => {
  it('trabalha em centavos', () => {
    expect(maskValorInvestido('1')).toBe('0,01')
    expect(maskValorInvestido('12')).toBe('0,12')
    expect(maskValorInvestido('123456')).toBe('1.234,56')
    expect(maskValorInvestido('100000000')).toBe('1.000.000,00')
  })
  it('ignora letras, zeros à esquerda e limita o tamanho', () => {
    expect(maskValorInvestido('R$ 1a2b3')).toBe('1,23')
    expect(maskValorInvestido('000150')).toBe('1,50')
    expect(maskValorInvestido('9'.repeat(30)).replace(/\D/g, '').length).toBe(14)
  })
  it('vazio e sem dígitos continuam vazios', () => {
    expect(maskValorInvestido('')).toBe('')
    expect(maskValorInvestido('abc')).toBe('')
  })
})

describe('formatValorInvestido', () => {
  it('formata em reais', () => {
    expect(formatValorInvestido(1234.5)?.replace(/\u00a0/g, ' ')).toBe('R$ 1.234,50')
    expect(formatValorInvestido(0)?.replace(/\u00a0/g, ' ')).toBe('R$ 0,00')
  })
  it('sem valor devolve null', () => {
    expect(formatValorInvestido(null)).toBeNull()
    expect(formatValorInvestido(undefined)).toBeNull()
    expect(formatValorInvestido(Number.NaN)).toBeNull()
  })
})
