import { describe, expect, it } from 'vitest'
import { mergeMassivaTicketsAfetados } from '@/features/massiva/lib/mergeMassivaTicketsAfetados'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function t(protocol: number, affected: number): MassivaTicket {
  return {
    protocol,
    assignmentId: null,
    title: '',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: 'aberta',
    openedAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    expectedCloseAt: null,
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: affected,
    usedFallback: false,
  }
}

describe('mergeMassivaTicketsAfetados', () => {
  it('no-op com mapa vazio; sobrescreve affectedClients e ETR do GET afetados', () => {
    const tickets = [t(0, 1), t(10, 2), t(20, 3)]
    expect(mergeMassivaTicketsAfetados(tickets, new Map())).toBe(tickets)
    const m = new Map([[10, { count: 99, estimateTimeOfRestoration: null }]])
    const out = mergeMassivaTicketsAfetados(tickets, m)
    expect(out[0].affectedClients).toBe(1)
    expect(out[1].affectedClients).toBe(99)
    expect(out[2].affectedClients).toBe(3)
    const withEtr = mergeMassivaTicketsAfetados(
      [t(10, 2)],
      new Map([[10, { count: 1, estimateTimeOfRestoration: 55 }]]),
    )
    expect(withEtr[0].affectedClients).toBe(1)
    expect(withEtr[0].estimateTimeOfRestoration).toBe(55)
  })
})
