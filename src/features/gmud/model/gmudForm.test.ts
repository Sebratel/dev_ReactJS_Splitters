import { describe, expect, it } from 'vitest'
import { buildGmudDescription } from '@/features/gmud/lib/buildGmudAssignmentMask'
import {
  emptyGmudForm,
  emptyGmudSistemasExternosData,
  emptyGmudSistemasInternosData,
  minDataProgramada,
  redeExternaCategoriaData,
  redeExternaImpactoData,
  validateGmudForm,
  validateGmudFormBySection,
  type GmudFormState,
} from '@/features/gmud/model/gmudForm'
import {
  emptyEscopoRede,
  formatEscopoRede,
  formatEscopoRotas,
  normalizeEscopoRede,
  normalizeEscopoRotas,
  rotasFromCategoriaData,
} from '@/features/gmud/model/gmudEscopoRede'

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

describe('impacto de parada da Rede Externa', () => {
  it('só grava tipo e duração quando há impacto e algo foi informado', () => {
    const base = { tipoIndisponibilidade: 'Parcial', duracaoEstimada: ' 2 horas ' }
    expect(redeExternaImpactoData({ ...base, impactoParada: 'Sim' })).toEqual({ tipoIndisponibilidade: 'Parcial', duracaoEstimada: '2 horas' })
    expect(redeExternaImpactoData({ ...base, impactoParada: 'Não' })).toBeNull()
    expect(redeExternaImpactoData({ tipoIndisponibilidade: '', duracaoEstimada: '', impactoParada: 'Sim' })).toBeNull()
  })

  it('entra na máscara do Elleven só quando há impacto', () => {
    const form: GmudFormState = { ...emptyGmudForm(), impactoParada: 'Sim', tipoIndisponibilidade: 'Total', duracaoEstimada: '30 minutos' }
    const comImpacto = buildGmudDescription(form)
    expect(comImpacto).toContain('Indisponibilidade: Total')
    expect(comImpacto).toContain('Duração estimada: 30 minutos')
    expect(buildGmudDescription({ ...form, impactoParada: 'Não' })).not.toContain('Duração estimada')
  })
})

describe('abrangência da Rede Externa (ponto de acesso, slot, PON, splitter)', () => {
  const semImpacto = { impactoParada: 'Não', tipoIndisponibilidade: '', duracaoEstimada: '' }
  const escopo = {
    apCode: 'AP-1',
    apTitle: 'OLT 01',
    slot: 2,
    ports: [5, 4, 5],
    splitters: [{ code: 'S1', title: 'SPL 1' }],
  }

  it('sem ponto de acesso não há afunilamento e nada é gravado', () => {
    expect(redeExternaCategoriaData({ ...semImpacto, escopoRotas: [emptyEscopoRede()] })).toBeNull()
  })

  it('grava o afunilamento limpo, mesmo sem impacto de parada', () => {
    expect(redeExternaCategoriaData({ ...semImpacto, escopoRotas: [escopo] })).toEqual({
      tipoIndisponibilidade: '',
      duracaoEstimada: '',
      escopoRotas: [{ apCode: 'AP-1', apTitle: 'OLT 01', slot: 2, ports: [4, 5], splitters: [{ code: 'S1', title: 'SPL 1' }] }],
    })
  })

  it('junta impacto de parada e afunilamento', () => {
    const data = redeExternaCategoriaData({
      impactoParada: 'Sim',
      tipoIndisponibilidade: 'Parcial',
      duracaoEstimada: '1 hora',
      escopoRotas: [escopo],
    })
    expect(data).toMatchObject({ tipoIndisponibilidade: 'Parcial', duracaoEstimada: '1 hora' })
    expect(data?.escopoRotas?.[0]?.apCode).toBe('AP-1')
  })

  it('PON só vale com slot escolhido', () => {
    expect(normalizeEscopoRede({ ...escopo, slot: null })?.ports).toEqual([])
  })

  it('formata o texto da abrangência e entra na máscara do Elleven', () => {
    expect(formatEscopoRede(escopo)).toBe('OLT 01 · Slot 2 · PONs 4, 5 · Splitter: SPL 1')
    expect(formatEscopoRede(emptyEscopoRede())).toBe('')
    const form: GmudFormState = { ...emptyGmudForm(), escopoRotas: [escopo] }
    expect(buildGmudDescription(form)).toContain('Abrangência na rede: OLT 01 · Slot 2 · PONs 4, 5 · Splitter: SPL 1')
    expect(buildGmudDescription(emptyGmudForm())).not.toContain('Abrangência na rede')
  })
  it('várias rotas: grava a lista sem repetir nem rotas vazias', () => {
    const outra = { apCode: 'AP-2', apTitle: 'OLT 02', slot: null, ports: [], splitters: [] }
    const data = redeExternaCategoriaData({ ...semImpacto, escopoRotas: [escopo, { ...escopo }, outra, emptyEscopoRede()] })
    expect(data?.escopoRotas).toHaveLength(2)
    expect(data?.escopoRotas?.map((r) => r.apCode)).toEqual(['AP-1', 'AP-2'])
    expect(normalizeEscopoRotas([escopo, escopo])).toHaveLength(1)
  })

  it('várias rotas: texto com uma frase por rota e entra na máscara do Elleven', () => {
    const outra = { apCode: 'AP-2', apTitle: 'OLT 02', slot: null, ports: [], splitters: [] }
    expect(formatEscopoRotas([escopo, outra])).toBe('OLT 01 · Slot 2 · PONs 4, 5 · Splitter: SPL 1; OLT 02')
    expect(formatEscopoRotas([])).toBe('')
    const form: GmudFormState = { ...emptyGmudForm(), escopoRotas: [escopo, outra] }
    expect(buildGmudDescription(form)).toContain('Abrangência na rede: OLT 01 · Slot 2 · PONs 4, 5 · Splitter: SPL 1; OLT 02')
  })

  it('GMUD antiga (um escopoRede) é lida como uma rota; lista nova tem prioridade', () => {
    expect(rotasFromCategoriaData({ escopoRede: escopo })).toHaveLength(1)
    expect(rotasFromCategoriaData({ escopoRotas: [], escopoRede: escopo })).toEqual([])
    expect(rotasFromCategoriaData(null)).toEqual([])
    expect(rotasFromCategoriaData({ escopoRotas: [escopo, escopo] })).toHaveLength(1)
  })

  it('clientes ponto a ponto e fibra apagada: grava o texto limpo, mesmo sem impacto nem rotas', () => {
    expect(redeExternaCategoriaData({ ...semImpacto, escopoRotas: [], clientesManuais: '  Cliente A - circuito 1\nCliente B  ' })).toEqual({
      tipoIndisponibilidade: '',
      duracaoEstimada: '',
      clientesManuais: 'Cliente A - circuito 1\nCliente B',
    })
    expect(redeExternaCategoriaData({ ...semImpacto, escopoRotas: [], clientesManuais: '   ' })).toBeNull()
  })

  it('clientes manuais entram na máscara do Elleven, uma frase por cliente', () => {
    const form: GmudFormState = { ...emptyGmudForm(), clientesManuais: 'Cliente A - circuito 1\n\nCliente B' }
    expect(buildGmudDescription(form)).toContain('Clientes ponto a ponto e fibra apagada: Cliente A - circuito 1; Cliente B')
    expect(buildGmudDescription(emptyGmudForm())).not.toContain('ponto a ponto')
  })

  it('"Comunica cliente?" deixou de ser obrigatório na Rede Externa', () => {
    const pend = validateGmudFormBySection({ ...emptyGmudForm('a@b.com', 'A'), categoria: 'rede_externa' })
    expect(pend.some((p) => /Comunica cliente/.test(p.message))).toBe(false)
  })
})
