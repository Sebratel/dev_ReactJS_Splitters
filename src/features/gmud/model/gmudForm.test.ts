import { describe, expect, it } from 'vitest'
import {
  emptyGmudForm,
  emptyGmudSistemasExternosData,
  emptyGmudSistemasInternosData,
  minDataProgramada,
  validateGmudForm,
  type GmudFormState,
} from '@/features/gmud/model/gmudForm'

describe('minDataProgramada', () => {
  it('aberta de quarta a segunda: terça da apresentação + 7 dias', () => {
    // 28/10/2026 é quarta; próxima terça 03/11; execução a partir de 10/11.
    expect(minDataProgramada(new Date(2026, 9, 28))).toBe('2026-11-10')
    expect(minDataProgramada(new Date(2026, 9, 30))).toBe('2026-11-10')
    expect(minDataProgramada(new Date(2026, 10, 2))).toBe('2026-11-10')
  })

  it('aberta numa terça: vale a apresentação da terça seguinte', () => {
    // 27/10/2026 é terça; próxima terça 03/11; execução a partir de 10/11.
    expect(minDataProgramada(new Date(2026, 9, 27))).toBe('2026-11-10')
  })

  it('a data mínima é sempre pelo menos 7 dias depois de hoje', () => {
    for (let dia = 0; dia < 14; dia++) {
      const hoje = new Date(2026, 9, 26 + dia)
      const [y, m, d] = minDataProgramada(hoje).split('-').map(Number)
      const diff = (new Date(y, m - 1, d).getTime() - hoje.getTime()) / 86_400_000
      expect(diff).toBeGreaterThanOrEqual(7)
    }
  })
})

function formBase(overrides: Partial<GmudFormState> = {}): GmudFormState {
  return {
    ...emptyGmudForm('a@sebratel.com.br', 'A'),
    tipo: 'Emergencial',
    titulo: 'Teste',
    categoria: 'sistemas_internos',
    dataInicio: '2026-11-10',
    horaInicio: '08:00',
    dataFim: '2026-11-10',
    horaFim: '10:00',
    ...overrides,
  }
}

describe('validateGmudForm — janela', () => {
  const si = emptyGmudSistemasInternosData()

  it('recusa fim antes do início', () => {
    const miss = validateGmudForm(formBase({ dataFim: '2026-11-09' }), si)
    expect(miss).toContain('Fim da janela deve ser depois do início')
  })

  it('recusa fim igual ao início no mesmo dia e horário', () => {
    const miss = validateGmudForm(formBase({ horaFim: '08:00' }), si)
    expect(miss).toContain('Fim da janela deve ser depois do início')
  })

  it('aceita fim depois do início', () => {
    const miss = validateGmudForm(formBase(), si)
    expect(miss).not.toContain('Fim da janela deve ser depois do início')
  })

  it('Programada exige a data mínima; Emergencial não', () => {
    const minimo = minDataProgramada()
    const cedo = formBase({ tipo: 'Programada', dataInicio: '2000-01-01', dataFim: '2000-01-02' })
    expect(validateGmudForm(cedo, si).some((m) => m.includes('GMUD Programada'))).toBe(true)

    const ok = formBase({ tipo: 'Programada', dataInicio: minimo, dataFim: minimo })
    expect(validateGmudForm(ok, si).some((m) => m.includes('GMUD Programada'))).toBe(false)

    const emergencial = formBase({ tipo: 'Emergencial', dataInicio: '2000-01-01', dataFim: '2000-01-02' })
    expect(validateGmudForm(emergencial, si).some((m) => m.includes('GMUD Programada'))).toBe(false)
  })
})

describe('validateGmudForm — áreas a avisar', () => {
  it('sistemas internos exige ao menos uma área impactada', () => {
    const si = emptyGmudSistemasInternosData()
    expect(validateGmudForm(formBase(), si)).toContain('Áreas impactadas (quem será avisado)')
    si.areasImpactadas = ['Comercial']
    expect(validateGmudForm(formBase(), si)).not.toContain('Áreas impactadas (quem será avisado)')
  })

  it('sistemas externos exige ao menos uma área afetada', () => {
    const se = emptyGmudSistemasExternosData()
    const form = formBase({ categoria: 'sistemas_externos' })
    expect(validateGmudForm(form, null, se)).toContain('Áreas afetadas (quem será avisado)')
    se.areasAfetadas = ['Atendimento']
    expect(validateGmudForm(form, null, se)).not.toContain('Áreas afetadas (quem será avisado)')
  })
})

describe('validateGmudForm — rede externa (matriz de aprovação)', () => {
  const msg = 'Recursos administrativos (ao menos uma área como Executor ou Validador)'
  const rede = (recursos: GmudFormState['recursosAdministrativos']) =>
    formBase({ categoria: 'rede_externa', recursosAdministrativos: recursos })

  it('exige ao menos uma área como Executor ou Validador', () => {
    expect(validateGmudForm(rede({}))).toContain(msg)
    expect(validateGmudForm(rede({ 'Oper/Infra': 'na', 'T&TI/CGR': 'na' }))).toContain(msg)
  })

  it('aceita quando há Executor ou Validador', () => {
    expect(validateGmudForm(rede({ 'Oper/Infra': 'executor' }))).not.toContain(msg)
    expect(validateGmudForm(rede({ 'T&TI/CGR': 'validador', 'Oper/Infra': 'na' }))).not.toContain(msg)
  })
})
