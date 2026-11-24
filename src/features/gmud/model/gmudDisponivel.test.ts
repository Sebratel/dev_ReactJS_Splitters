import { describe, expect, it } from 'vitest'
import { isGmudDisponivel } from '@/features/gmud/model/gmud'

describe('isGmudDisponivel (Comitê e áreas decidem em paralelo)', () => {
  it('libera quando o Comitê aprovou e as áreas aprovaram ou não se aplicam', () => {
    expect(isGmudDisponivel('aprovada', 'aprovada')).toBe(true)
    expect(isGmudDisponivel('aprovada', 'nao_aplicavel')).toBe(true)
    expect(isGmudDisponivel('aprovada')).toBe(true)
    expect(isGmudDisponivel('aprovada', null)).toBe(true)
  })

  it('não libera enquanto as áreas estão pendentes ou se uma negou', () => {
    expect(isGmudDisponivel('aprovada', 'pendente')).toBe(false)
    expect(isGmudDisponivel('aprovada', 'negada')).toBe(false)
  })

  it('não libera sem aprovação do Comitê, mesmo com as áreas aprovadas', () => {
    expect(isGmudDisponivel('pendente', 'aprovada')).toBe(false)
    expect(isGmudDisponivel('negada', 'aprovada')).toBe(false)
    expect(isGmudDisponivel(null, 'aprovada')).toBe(false)
  })
})
