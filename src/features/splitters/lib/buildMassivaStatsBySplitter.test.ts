import { describe, expect, it } from 'vitest'
import { buildMassivaStatsBySplitter } from '@/features/splitters/lib/buildMassivaStatsBySplitter'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket>): MassivaTicket {
  return {
    protocol: partial.protocol ?? 1,
    assignmentId: null,
    title: partial.title ?? 'Registro Incidente de Rede',
    description: '',
    apCode: '',
    splitterCode: partial.splitterCode ?? 'SPL-01',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'open',
    ellevenIncidentStatusId: null,
    openedAt: null,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: 1,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
    ...partial,
  }
}

describe('buildMassivaStatsBySplitter', () => {
  it('usa status efetivo Elleven e ignora fora do catálogo', () => {
    const map = buildMassivaStatsBySplitter([
      ticket({ protocol: 1, splitterCode: 'SPL-01', ellevenLifecycle: 'closed', status: 'aberta' }),
      ticket({ protocol: 2, splitterCode: 'SPL-01', status: 'aberta' }),
      ticket({
        protocol: 3,
        splitterCode: 'SPL-01',
        title: 'Chamado avulso',
        status: 'aberta',
      }),
    ])
    const stats = map.get('n:spl-01')
    expect(stats?.totalTickets).toBe(2)
    expect(stats?.openTickets).toBe(1)
    expect(stats?.closedTickets).toBe(1)
  })
})
