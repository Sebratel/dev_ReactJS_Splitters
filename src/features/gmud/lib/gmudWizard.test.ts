import { describe, expect, it } from 'vitest'
import { pendenciasDaEtapa, primeiraEtapaPendente, wizardSteps, wizardStates } from '@/features/gmud/lib/gmudWizard'
import {
  emptyGmudForm,
  emptyGmudSistemasExternosData,
  emptyGmudSistemasInternosData,
  validateGmudFormBySection,
} from '@/features/gmud/model/gmudForm'

describe('wizardSteps', () => {
  it('sempre cinco etapas, a última é a revisão', () => {
    for (const c of ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const) {
      const steps = wizardSteps(c)
      expect(steps).toHaveLength(5)
      expect(steps[4]?.key).toBe('revisao')
    }
  })

  it('toda pendência possível cai numa etapa (nenhuma seção fica órfã)', () => {
    for (const categoria of ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const) {
      const form = { ...emptyGmudForm('a@b.com', 'A'), categoria }
      const si = categoria === 'sistemas_internos' ? emptyGmudSistemasInternosData() : null
      const se = categoria === 'sistemas_externos' ? emptyGmudSistemasExternosData() : null
      const pend = validateGmudFormBySection(form, si, se)
      const steps = wizardSteps(categoria)
      for (const p of pend) {
        expect(steps.some((s) => s.sections.includes(p.section)), `${categoria}: ${p.section}`).toBe(true)
      }
    }
  })

  it('uma seção não aparece em duas etapas', () => {
    for (const c of ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const) {
      const todas = wizardSteps(c).flatMap((s) => s.sections)
      expect(new Set(todas).size).toBe(todas.length)
    }
  })
})

describe('pendências por etapa e estados', () => {
  const steps = wizardSteps('rede_externa')
  const pend = [
    { section: 'Atividade', message: 'POP/Site' },
    { section: 'Janela de mudança', message: 'Janela de início' },
  ]
  it('separa as pendências por etapa', () => {
    expect(pendenciasDaEtapa(pend, steps[1]!)).toHaveLength(1)
    expect(pendenciasDaEtapa(pend, steps[3]!)).toHaveLength(1)
    expect(pendenciasDaEtapa(pend, steps[0]!)).toHaveLength(0)
    expect(primeiraEtapaPendente(steps, pend)).toBe(1)
    expect(primeiraEtapaPendente(steps, [])).toBe(-1)
  })
  it('estados: atual, completas, atenção e ainda não alcançadas', () => {
    expect(wizardStates(steps, 2, 2, pend)).toEqual(['done', 'attention', 'current', 'pending', 'pending'])
    expect(wizardStates(steps, 0, 3, [])).toEqual(['current', 'done', 'done', 'done', 'pending'])
  })
})
