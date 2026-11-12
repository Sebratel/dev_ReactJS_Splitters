import { describe, expect, it } from 'vitest'
import { requesterInitials, shortRequesterName } from '@/features/gmud/lib/gmudRequester'

describe('shortRequesterName', () => {
  it('primeiro e último nome, em caixa de título', () => {
    expect(shortRequesterName('LUCAS EDUARDO SCHEUER')).toBe('Lucas Scheuer')
    expect(shortRequesterName('Bruno Fagundes Soares')).toBe('Bruno Soares')
  })
  it('ignora partículas', () => {
    expect(shortRequesterName('MISAEL GOMES DA CRUZ')).toBe('Misael Cruz')
    expect(shortRequesterName('ZORABEL DEL CARMEN APARICIO AVILEZ')).toBe('Zorabel Avilez')
  })
  it('nome único e vazio', () => {
    expect(shortRequesterName('RAFAEL')).toBe('Rafael')
    expect(shortRequesterName('  ')).toBe('—')
    expect(shortRequesterName(null)).toBe('—')
  })
})

describe('requesterInitials', () => {
  it('duas letras', () => {
    expect(requesterInitials('MISAEL GOMES DA CRUZ')).toBe('MC')
    expect(requesterInitials('Rafael')).toBe('R')
    expect(requesterInitials('')).toBe('?')
  })
})
