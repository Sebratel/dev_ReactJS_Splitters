import { describe, expect, it } from 'vitest'
import {
  emptyGmudForm,
  emptyGmudSistemasExternosData,
  emptyGmudSistemasInternosData,
  validateGmudForm,
  validateGmudFormBySection,
} from '@/features/gmud/model/gmudForm'

const COMUNS = ['Identificação', 'Janela de mudança']
const POR_CATEGORIA = {
  rede_externa: [...COMUNS, 'Atividade', 'Ambiente afetado', 'Impacto', 'Execução', 'Recursos administrativos'],
  sistemas_internos: [...COMUNS, 'Sistema', 'Descrição', 'Impacto', 'Execução'],
  sistemas_externos: [...COMUNS, 'Sistema e fornecedor', 'Mudança prevista', 'Impacto', 'Contingência'],
} as const

describe('pendências por seção do formulário', () => {
  for (const categoria of Object.keys(POR_CATEGORIA) as Array<keyof typeof POR_CATEGORIA>) {
    it(`${categoria}: toda pendência aponta para uma seção que existe na tela`, () => {
      const form = { ...emptyGmudForm('a@b.com', 'A'), categoria }
      const si = categoria === 'sistemas_internos' ? emptyGmudSistemasInternosData() : null
      const se = categoria === 'sistemas_externos' ? emptyGmudSistemasExternosData() : null
      const pend = validateGmudFormBySection(form, si, se)
      expect(pend.length).toBeGreaterThan(0)
      for (const p of pend) expect(POR_CATEGORIA[categoria]).toContain(p.section)
      // a lista de mensagens antiga continua idêntica
      expect(validateGmudForm(form, si, se)).toEqual(pend.map((p) => p.message))
    })
  }

  it('cada seção com campo obrigatório aparece vazia como pendente', () => {
    const form = { ...emptyGmudForm('a@b.com', 'A'), categoria: 'rede_externa' as const }
    const secoes = new Set(validateGmudFormBySection(form).map((p) => p.section))
    for (const s of POR_CATEGORIA.rede_externa) expect(secoes.has(s)).toBe(true)
  })
})
