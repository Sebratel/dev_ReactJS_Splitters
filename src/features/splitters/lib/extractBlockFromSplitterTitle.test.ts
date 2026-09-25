import { describe, expect, it } from 'vitest'
import { extractBlockFromSplitterTitle } from './extractBlockFromSplitterTitle'

describe('extractBlockFromSplitterTitle', () => {
  it('extrai o bloco de "BL X" e "BLOCO X" (maiúsculo)', () => {
    expect(extractBlockFromSplitterTitle('COND. PREMIERE - BL A - 8°')).toBe('A')
    expect(extractBlockFromSplitterTitle('RES. FLAMBOYANT - BLOCO d')).toBe('D')
    expect(extractBlockFromSplitterTitle('ED. X - BL 2')).toBe('2')
  })

  it('retorna null quando não há bloco no título', () => {
    expect(extractBlockFromSplitterTitle('SLE-C-3919 - RUA ABC 123')).toBeNull()
    expect(extractBlockFromSplitterTitle('')).toBeNull()
    expect(extractBlockFromSplitterTitle(null)).toBeNull()
    expect(extractBlockFromSplitterTitle(undefined)).toBeNull()
  })

  it('exige a fronteira de palavra (não casa "TABLADO")', () => {
    expect(extractBlockFromSplitterTitle('CONDOMINIO TABLADO A')).toBeNull()
  })
})
