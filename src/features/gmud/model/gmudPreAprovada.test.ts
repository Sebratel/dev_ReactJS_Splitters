import { describe, expect, it } from 'vitest'
import {
  GMUD_TIPO_OPTIONS,
  GMUD_TIPO_PRE_APROVADA,
  emptyGmudForm,
  minDataProgramada,
  validateGmudForm,
  type GmudFormState,
} from '@/features/gmud/model/gmudForm'

/** Formulário de rede externa completo, para só variar o que o teste quer. */
function redeExternaCompleta(extra: Partial<GmudFormState> = {}): GmudFormState {
  return {
    ...emptyGmudForm('ana@sebratel.com.br', 'Ana'),
    categoria: 'rede_externa',
    tipo: GMUD_TIPO_PRE_APROVADA,
    assunto: 'Manutenção preventiva',
    titulo: 'Limpeza de conectores',
    descricao: 'Limpeza programada',
    popSite: 'SLESC',
    riscoNaoImplementacao: 'Degradação',
    ambienteAfetado: ['Rede'],
    comunicaCliente: 'Não',
    impactoParada: 'Não',
    planoExecucao: 'Passo a passo',
    dataInicio: minDataProgramada(),
    horaInicio: '02:00',
    dataFim: minDataProgramada(),
    horaFim: '05:00',
    ...extra,
  }
}

const faltas = (form: GmudFormState) => validateGmudForm(form)

describe('GMUD Pré-aprovada no formulário', () => {
  it('é um tipo selecionável', () => {
    expect(GMUD_TIPO_OPTIONS).toContain(GMUD_TIPO_PRE_APROVADA)
  })

  it('sem repetição (padrão 1) é válida', () => {
    expect(faltas(redeExternaCompleta()).filter((m) => /Repetição|Pré-aprovada/.test(m))).toEqual([])
  })

  it('repetindo exige quantidade e intervalo válidos', () => {
    expect(faltas(redeExternaCompleta({ repeticaoVezes: '4', repeticaoIntervaloDias: '15' })).some((m) => /Repetição/.test(m))).toBe(false)
    expect(faltas(redeExternaCompleta({ repeticaoVezes: '4', repeticaoIntervaloDias: '' })).some((m) => /Repetição/.test(m))).toBe(true)
    expect(faltas(redeExternaCompleta({ repeticaoVezes: '13', repeticaoIntervaloDias: '15' })).some((m) => /Repetição/.test(m))).toBe(true)
    expect(faltas(redeExternaCompleta({ repeticaoVezes: '0' })).some((m) => /Repetição/.test(m))).toBe(true)
  })

  it('mantém a antecedência mínima da Programada para a primeira ocorrência', () => {
    const msgs = faltas(redeExternaCompleta({ dataInicio: '2000-01-01', dataFim: '2000-01-02' }))
    expect(msgs.some((m) => m.includes('GMUD Pré-aprovada') && m.includes('a partir de'))).toBe(true)
  })

  it('está disponível nas três categorias (sem erro de categoria; só vale a repetição)', () => {
    for (const categoria of ['rede_externa', 'sistemas_internos', 'sistemas_externos'] as const) {
      const msgs = faltas(redeExternaCompleta({ categoria }))
      expect(msgs.some((m) => /Pré-aprovada só está disponível|só está disponível/.test(m)), categoria).toBe(false)
    }
    // a validação de repetição continua valendo fora da Rede Externa
    const invalida = faltas(redeExternaCompleta({ categoria: 'sistemas_externos', repeticaoVezes: '13', repeticaoIntervaloDias: '15' }))
    expect(invalida.some((m) => /Repetição/.test(m))).toBe(true)
  })

  it('Programada e Emergencial não são afetadas pelos campos de repetição', () => {
    for (const tipo of ['Programada', 'Emergencial']) {
      const msgs = faltas(redeExternaCompleta({ tipo, repeticaoVezes: '99', repeticaoIntervaloDias: '' }))
      expect(msgs.some((m) => /Repetição/.test(m))).toBe(false)
    }
  })
})
