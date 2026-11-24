import { describe, expect, it } from 'vitest'
import { podeAbrirGmudPreAprovada } from '@/features/gmud/lib/gmudPermissoes'

describe('podeAbrirGmudPreAprovada', () => {
  it('admin e quem recebeu a permissão podem', () => {
    expect(podeAbrirGmudPreAprovada({ isAdmin: true, canOpenGmudPreAprovada: false })).toBe(true)
    expect(podeAbrirGmudPreAprovada({ isAdmin: false, canOpenGmudPreAprovada: true })).toBe(true)
  })
  it('os demais não, e sem perfil também não (padrão fechado)', () => {
    expect(podeAbrirGmudPreAprovada({ isAdmin: false, canOpenGmudPreAprovada: false })).toBe(false)
    expect(podeAbrirGmudPreAprovada(null)).toBe(false)
    expect(podeAbrirGmudPreAprovada(undefined)).toBe(false)
  })
})
