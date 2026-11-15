import { describe, expect, it } from 'vitest'
import {
  addDias,
  agruparPorDia,
  diaDaSemana,
  formatarIntervalo,
  hojeEmSaoPaulo,
  modoPadraoDaReuniao,
  ordenarFeito,
  resumoFeito,
  resumoVem,
  rotuloDoDia,
  segundaDaSemana,
  segundaDoFeito,
  semanasDaReuniao,
  type GmudReuniaoFeitoItem,
  type GmudReuniaoItem,
  type GmudReuniaoResultado,
} from '@/features/gmud/lib/gmudReuniaoSemana'

const item = (protocolo: number, dataInicio: string | null, horaInicio: string | null, over: Partial<GmudReuniaoItem> = {}): GmudReuniaoItem => ({
  protocolo,
  titulo: `GMUD ${protocolo}`,
  tipo: 'Programada',
  categoria: 'rede_externa',
  popSite: null,
  sistema: null,
  janela: { dataInicio, horaInicio, dataFim: dataInicio, horaFim: '05:00' },
  impactoParada: 'Não',
  statusComite: 'aprovada',
  statusAreas: 'nao_aplicavel',
  areasTotal: 0,
  areasAprovadas: 0,
  statusExec: null,
  ellevenEncerradoEm: null,
  ellevenEncerradoStatus: null,
  statusVoalle: 'Abertura',
  reagendada: false,
  ...over,
})
const feito = (protocolo: number, resultado: GmudReuniaoResultado, dataInicio: string, horaInicio = '01:00'): GmudReuniaoFeitoItem => ({
  ...item(protocolo, dataInicio, horaInicio),
  resultado,
  novaJanela: null,
})

describe('semanas da reunião', () => {
  it('segunda-feira da semana, de segunda a domingo', () => {
    expect(segundaDaSemana('2026-11-09')).toBe('2026-11-09') // segunda
    expect(segundaDaSemana('2026-11-11')).toBe('2026-11-09') // quarta
    expect(segundaDaSemana('2026-11-15')).toBe('2026-11-09') // domingo fecha a semana
    expect(segundaDaSemana('2026-11-16')).toBe('2026-11-16')
    expect(diaDaSemana('2026-11-15')).toBe(0)
    expect(diaDaSemana('2026-11-09')).toBe(1)
  })

  it('vira mês e ano sem errar', () => {
    expect(segundaDaSemana('2026-12-01')).toBe('2026-11-30') // terça, semana começou no mês anterior
    expect(segundaDaSemana('2027-01-01')).toBe('2026-12-28') // sexta, semana começou no ano anterior
    expect(segundaDaSemana('2027-01-03')).toBe('2026-12-28') // domingo
    expect(addDias('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDias('2028-02-28', 1)).toBe('2028-02-29') // ano bissexto
    expect(addDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(semanasDaReuniao('2026-12-21')).toEqual({ feitoDe: '2026-12-21', feitoAte: '2026-12-27', vemDe: '2026-12-28', vemAte: '2027-01-03' })
  })

  it('o "vem" é sempre a semana seguinte ao "feito"', () => {
    expect(semanasDaReuniao('2026-11-09')).toEqual({ feitoDe: '2026-11-09', feitoAte: '2026-11-15', vemDe: '2026-11-16', vemAte: '2026-11-22' })
  })

  it('padrão por dia da semana: segunda a quarta abre na semana passada; quinta a domingo, nesta', () => {
    expect(modoPadraoDaReuniao('2026-11-16')).toBe('passada') // segunda
    expect(modoPadraoDaReuniao('2026-11-17')).toBe('passada') // terça
    expect(modoPadraoDaReuniao('2026-11-18')).toBe('passada') // quarta
    expect(modoPadraoDaReuniao('2026-11-19')).toBe('esta') // quinta
    expect(modoPadraoDaReuniao('2026-11-20')).toBe('esta') // sexta
    expect(modoPadraoDaReuniao('2026-11-21')).toBe('esta') // sábado
    expect(modoPadraoDaReuniao('2026-11-22')).toBe('esta') // domingo
  })

  it('atalhos: semana passada e esta semana', () => {
    expect(segundaDoFeito('2026-11-17', 'passada')).toBe('2026-11-09')
    expect(segundaDoFeito('2026-11-17', 'esta')).toBe('2026-11-16')
    expect(segundaDoFeito('2026-11-22', 'esta')).toBe('2026-11-16') // domingo ainda é "esta semana"
    expect(segundaDoFeito('2027-01-04', 'passada')).toBe('2026-12-28')
  })

  it('hoje em Brasília, mesmo quando em UTC já é o dia seguinte', () => {
    expect(hojeEmSaoPaulo(new Date('2026-11-17T02:30:00Z'))).toBe('2026-11-16') // 23:30 de segunda em Brasília
    expect(hojeEmSaoPaulo(new Date('2026-11-17T03:00:00Z'))).toBe('2026-11-17')
    expect(hojeEmSaoPaulo(new Date('2027-01-01T01:00:00Z'))).toBe('2026-12-31')
  })

  it('textos do intervalo e do dia', () => {
    expect(formatarIntervalo('2026-11-09', '2026-11-15')).toBe('09/11 a 15/11')
    expect(rotuloDoDia('2026-11-16')).toBe('Segunda, 16/11')
    expect(rotuloDoDia('2026-11-22')).toBe('Domingo, 22/11')
  })
})

describe('bloco "O que foi feito"', () => {
  const lista = [
    feito(1, 'concluida', '2026-11-09'),
    feito(2, 'cancelada', '2026-11-10'),
    feito(3, 'nao_concluida', '2026-11-12'),
    feito(4, 'reagendada', '2026-11-11'),
    feito(5, 'nao_concluida', '2026-11-10', '03:00'),
    feito(6, 'nao_concluida', '2026-11-10', '01:00'),
    feito(7, 'janela_aberta', '2026-11-13'),
    feito(8, 'concluida', '2026-11-09', '00:30'),
  ]

  it('primeiro o que não saiu como planejado, depois as concluídas; dentro do grupo, por janela', () => {
    const ordenada = ordenarFeito(lista)
    expect(ordenada.map((i) => i.protocolo)).toEqual([6, 5, 3, 4, 2, 7, 8, 1])
    expect(ordenada.map((i) => i.resultado)).toEqual([
      'nao_concluida', 'nao_concluida', 'nao_concluida', 'reagendada', 'cancelada', 'janela_aberta', 'concluida', 'concluida',
    ])
    // Não mexe na lista original.
    expect(lista[0]?.protocolo).toBe(1)
  })

  it('resumo em quatro números', () => {
    expect(resumoFeito(lista)).toEqual({ concluidas: 2, reagendadas: 1, canceladas: 1, naoConcluidas: 3 })
    expect(resumoFeito([])).toEqual({ concluidas: 0, reagendadas: 0, canceladas: 0, naoConcluidas: 0 })
  })
})

describe('bloco "O que vem"', () => {
  const lista = [
    item(1, '2026-11-18', '03:00'),
    item(2, '2026-11-16', '22:00', { statusComite: 'pendente' }),
    item(3, '2026-11-18', '01:00', { impactoParada: 'Sim' }),
    item(4, '2026-11-14', '23:00', { statusAreas: 'pendente', impactoParada: 'Sim' }), // começou antes da semana
    item(5, '2026-11-22', null),
    item(6, null, null),
  ]

  it('agrupa por dia (só dias com GMUD), em ordem de data e de hora', () => {
    const dias = agruparPorDia(lista, '2026-11-16')
    expect(dias.map((d) => d.dia)).toEqual(['2026-11-16', '2026-11-18', '2026-11-22'])
    // A que começou antes da semana cai no primeiro dia dela; sem data não entra.
    expect(dias[0]?.items.map((i) => i.protocolo)).toEqual([4, 2])
    expect(dias[1]?.items.map((i) => i.protocolo)).toEqual([3, 1])
    expect(dias[2]?.items.map((i) => i.protocolo)).toEqual([5])
    expect(agruparPorDia([], '2026-11-16')).toEqual([])
  })

  it('resumo: programadas, liberadas, aguardando aprovação e com parada', () => {
    expect(resumoVem(lista)).toEqual({ programadas: 6, liberadas: 4, aguardando: 2, comParada: 2 })
  })
})
