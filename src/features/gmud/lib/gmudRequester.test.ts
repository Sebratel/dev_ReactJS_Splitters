import { describe, expect, it } from 'vitest'
import { requesterAvatarIndex, requesterInitials, shortRequesterName } from '@/features/gmud/lib/gmudRequester'

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

describe('requesterAvatarIndex', () => {
  it('é estável por pessoa e ignora caixa e espaços', () => {
    const a = requesterAvatarIndex('ana@sebratel.com', 6)
    expect(requesterAvatarIndex('ana@sebratel.com', 6)).toBe(a)
    expect(requesterAvatarIndex('  ANA@Sebratel.com ', 6)).toBe(a)
  })
  it('fica sempre dentro da paleta, inclusive sem chave', () => {
    for (const key of ['', null, undefined, 'bruno@sebratel.com', 'LUCAS EDUARDO SCHEUER', 'x'.repeat(500)]) {
      const i = requesterAvatarIndex(key, 6)
      expect(Number.isInteger(i)).toBe(true)
      expect(i).toBeGreaterThanOrEqual(0)
      expect(i).toBeLessThan(6)
    }
    expect(requesterAvatarIndex('ana', 0)).toBe(0)
  })
  it('espalha pessoas diferentes por mais de uma cor', () => {
    const nomes = ['ana', 'bruno', 'carla', 'diego', 'elaine', 'fabio', 'gisele', 'heitor', 'iara', 'joao']
    expect(new Set(nomes.map((n) => requesterAvatarIndex(`${n}@sebratel.com`, 6))).size).toBeGreaterThan(1)
  })
})
