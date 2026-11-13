import { describe, expect, it } from 'vitest'
import { GMUD_TIPO_CRITICIDADE } from '@/features/gmud/lib/gmudTipoCriticidade'
import { GMUD_TIPO_OPTIONS } from '@/features/gmud/model/gmudForm'

describe('criticidade dos tipos de GMUD', () => {
  it('todo tipo tem rótulo, ícone e cor próprios (a cor não é a única pista)', () => {
    const labels = new Set<string>()
    const icons = new Set<string>()
    for (const tipo of GMUD_TIPO_OPTIONS) {
      const c = GMUD_TIPO_CRITICIDADE[tipo]
      expect(c, tipo).toBeDefined()
      expect(c.label.trim()).not.toBe('')
      labels.add(c.label)
      icons.add(c.icon)
    }
    expect(labels.size).toBe(GMUD_TIPO_OPTIONS.length)
    expect(icons.size).toBe(GMUD_TIPO_OPTIONS.length)
  })

  it('Emergencial é o nível urgente', () => {
    expect(GMUD_TIPO_CRITICIDADE.Emergencial.label).toBe('Urgente')
  })
})
