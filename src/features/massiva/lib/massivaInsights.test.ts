import { describe, expect, it } from 'vitest'
import {
  buildMassivaChartSeries,
  percentChange,
  rankMassivaAccessPoints,
  summarizeMassivaSla,
} from '@/features/massiva/lib/massivaInsights'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  return {
    protocol: partial.protocol,
    assignmentId: partial.assignmentId ?? 1,
    title: partial.title ?? 'Registro Incidente de Rede',
    description: partial.description ?? '',
    apCode: partial.apCode ?? 'AP-1',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'encerrada',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'closed',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: partial.openedAt ?? new Date('2026-06-10T08:00:00'),
    expectedCloseAt: partial.expectedCloseAt ?? null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? null,
    closeDescription: null,
    affectedClients: partial.affectedClients ?? 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('buildMassivaChartSeries', () => {
  it('agrupa por dia e soma afetados por tipo', () => {
    const series = buildMassivaChartSeries(
      [
        ticket({ protocol: 1, openedAt: new Date('2026-06-10T08:00:00'), affectedClients: 10, title: 'Incidente Massivo' }),
        ticket({ protocol: 2, openedAt: new Date('2026-06-10T20:00:00'), affectedClients: 5, title: 'Evento Massivo' }),
        ticket({ protocol: 3, openedAt: new Date('2026-06-11T09:00:00'), affectedClients: 7, title: 'Incidente Massivo' }),
      ],
      { granularity: 'day', start: new Date('2026-06-01'), end: new Date('2026-06-30T23:59:59') },
    )
    expect(series).toHaveLength(2)
    expect(series[0]?.affectedTotal).toBe(15)
    expect(series[0]?.affectedIncident).toBe(10)
    expect(series[0]?.affectedEvent).toBe(5)
    expect(series[0]?.protocols).toBe(2)
    expect(series[1]?.affectedTotal).toBe(7)
  })

  it('ignora tickets fora da janela', () => {
    const series = buildMassivaChartSeries(
      [
        ticket({ protocol: 1, openedAt: new Date('2026-05-30T08:00:00'), affectedClients: 99 }),
        ticket({ protocol: 2, openedAt: new Date('2026-06-10T08:00:00'), affectedClients: 4 }),
      ],
      { granularity: 'day', start: new Date('2026-06-01'), end: new Date('2026-06-30T23:59:59') },
    )
    expect(series).toHaveLength(1)
    expect(series[0]?.affectedTotal).toBe(4)
  })

  it('agrupa por mês quando granularidade é month', () => {
    const series = buildMassivaChartSeries(
      [
        ticket({ protocol: 1, openedAt: new Date('2026-05-10T08:00:00'), affectedClients: 3 }),
        ticket({ protocol: 2, openedAt: new Date('2026-06-10T08:00:00'), affectedClients: 8 }),
        ticket({ protocol: 3, openedAt: new Date('2026-06-20T08:00:00'), affectedClients: 2 }),
      ],
      { granularity: 'month', start: new Date('2026-01-01'), end: new Date('2026-12-31T23:59:59') },
    )
    expect(series).toHaveLength(2)
    expect(series[1]?.affectedTotal).toBe(10)
  })
})

describe('summarizeMassivaSla', () => {
  it('conta encerradas dentro da previsão', () => {
    const sla = summarizeMassivaSla([
      ticket({ protocol: 1, closedAt: new Date('2026-06-10T12:00:00'), expectedCloseAt: new Date('2026-06-10T18:00:00') }),
      ticket({ protocol: 2, closedAt: new Date('2026-06-10T20:00:00'), expectedCloseAt: new Date('2026-06-10T18:00:00') }),
      ticket({ protocol: 3, closedAt: null, expectedCloseAt: new Date('2026-06-10T18:00:00') }),
    ])
    expect(sla.evaluated).toBe(2)
    expect(sla.within).toBe(1)
    expect(sla.pct).toBe(50)
  })

  it('pct null sem base avaliável', () => {
    expect(summarizeMassivaSla([]).pct).toBeNull()
  })
})

describe('rankMassivaAccessPoints', () => {
  it('ordena por nº de protocolos, afetados desempata', () => {
    const ranking = rankMassivaAccessPoints([
      ticket({ protocol: 1, apCode: 'AP-A', affectedClients: 5 }),
      ticket({ protocol: 2, apCode: 'AP-A', affectedClients: 5 }),
      ticket({ protocol: 3, apCode: 'AP-B', affectedClients: 50 }),
    ])
    expect(ranking[0]?.apCode).toBe('AP-A')
    expect(ranking[0]?.protocols).toBe(2)
    expect(ranking[1]?.apCode).toBe('AP-B')
  })

  it('ignora AP vazio e respeita limite', () => {
    const ranking = rankMassivaAccessPoints(
      [
        ticket({ protocol: 1, apCode: '' }),
        ticket({ protocol: 2, apCode: 'AP-A' }),
        ticket({ protocol: 3, apCode: 'AP-B' }),
        ticket({ protocol: 4, apCode: 'AP-C' }),
      ],
      2,
    )
    expect(ranking).toHaveLength(2)
  })
})

describe('percentChange', () => {
  it('calcula variação', () => {
    expect(percentChange(120, 100)).toBeCloseTo(20)
    expect(percentChange(80, 100)).toBeCloseTo(-20)
  })
  it('base zero: null se subiu, 0 se permanece em zero', () => {
    expect(percentChange(10, 0)).toBeNull()
    expect(percentChange(0, 0)).toBe(0)
  })
})
