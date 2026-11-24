import { describe, expect, it } from 'vitest'
import {
  GMUD_REPETICAO_MAX_VEZES,
  addDaysYmd,
  buildGmudOccurrences,
  buildOccurrenceTitle,
  describeSerie,
  parseRepeticao,
} from '@/features/gmud/lib/gmudRecurrence'

describe('addDaysYmd', () => {
  it('soma dias atravessando mês e ano', () => {
    expect(addDaysYmd('2026-11-20', 15)).toBe('2026-12-05')
    expect(addDaysYmd('2026-12-25', 15)).toBe('2027-01-09')
    expect(addDaysYmd('2028-02-20', 10)).toBe('2028-03-01') // ano bissexto
  })
  it('data inválida volta como veio', () => {
    expect(addDaysYmd('x', 3)).toBe('x')
  })
})

describe('parseRepeticao', () => {
  it('uma vez só ignora o intervalo', () => {
    expect(parseRepeticao('1', '')).toEqual({ vezes: 1, intervaloDias: 0 })
  })
  it('várias vezes exige intervalo válido', () => {
    expect(parseRepeticao('4', '15')).toEqual({ vezes: 4, intervaloDias: 15 })
    expect(parseRepeticao('4', '')).toBeNull()
    expect(parseRepeticao('4', '0')).toBeNull()
    expect(parseRepeticao('4', '366')).toBeNull()
    expect(parseRepeticao('2', '1.5')).toBeNull()
  })
  it('limites de vezes', () => {
    expect(parseRepeticao('0', '15')).toBeNull()
    expect(parseRepeticao(String(GMUD_REPETICAO_MAX_VEZES + 1), '15')).toBeNull()
    expect(parseRepeticao(String(GMUD_REPETICAO_MAX_VEZES), '15')).not.toBeNull()
    expect(parseRepeticao('abc', '15')).toBeNull()
  })
})

describe('buildGmudOccurrences', () => {
  it('4 vezes a cada 15 dias: abre 4 protocolos, cada um com a sua data', () => {
    const occ = buildGmudOccurrences({ dataInicio: '2026-11-20', dataFim: '2026-11-20', vezes: 4, intervaloDias: 15 })
    expect(occ.map((o) => o.dataInicio)).toEqual(['2026-11-20', '2026-12-05', '2026-12-20', '2027-01-04'])
    expect(occ.map((o) => o.indice)).toEqual([1, 2, 3, 4])
    expect(occ.every((o) => o.total === 4)).toBe(true)
  })
  it('mantém a duração quando a janela atravessa a meia-noite', () => {
    const occ = buildGmudOccurrences({ dataInicio: '2026-11-20', dataFim: '2026-11-21', vezes: 2, intervaloDias: 7 })
    expect(occ[1]).toMatchObject({ dataInicio: '2026-11-27', dataFim: '2026-11-28' })
  })
  it('sem repetição devolve só a ocorrência original', () => {
    const occ = buildGmudOccurrences({ dataInicio: '2026-11-20', dataFim: '2026-11-20', vezes: 1, intervaloDias: 0 })
    expect(occ).toEqual([{ indice: 1, total: 1, dataInicio: '2026-11-20', dataFim: '2026-11-20' }])
  })
})

describe('título e descrição da série', () => {
  it('só acrescenta (k/N) quando há repetição', () => {
    expect(buildOccurrenceTitle('GMUD Pré-aprovada SLESC', 2, 4)).toBe('GMUD Pré-aprovada SLESC (2/4)')
    expect(buildOccurrenceTitle('GMUD Pré-aprovada SLESC', 1, 1)).toBe('GMUD Pré-aprovada SLESC')
  })
  it('describeSerie', () => {
    expect(describeSerie({ indice: 2, total: 4, intervaloDias: 15 })).toBe('Ocorrência 2 de 4 · a cada 15 dias')
    expect(describeSerie({ indice: 1, total: 1, intervaloDias: 0 })).toBeNull()
    expect(describeSerie(null)).toBeNull()
  })
})
