import { describe, expect, it, beforeEach } from 'vitest'
import { pruneRecentOpensClosedByBff } from '@/features/massiva/lib/pruneRecentOpensAgainstBff'
import {
  appendRecentOpenTicketsToStorage,
  readRecentOpenTicketsFromStorage,
} from '@/features/massiva/lib/massivaRecentOpensStorage'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  return {
    protocol: partial.protocol,
    assignmentId: null,
    title: partial.title ?? 'OLT teste',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'encerrada',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'closed',
    ellevenIncidentStatusId: null,
    openedAt: partial.openedAt ?? new Date(),
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? new Date(),
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('pruneRecentOpensClosedByBff', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('remove protocolo do sessionStorage quando BFF indica encerrado', () => {
    appendRecentOpenTicketsToStorage([
      ticket({ protocol: 1676359, status: 'aberta', ellevenLifecycle: 'open', closedAt: null }),
    ])
    pruneRecentOpensClosedByBff([
      ticket({ protocol: 1676359, ellevenLifecycle: 'closed' }),
    ])
    expect(readRecentOpenTicketsFromStorage()).toHaveLength(0)
  })

  it('remove protocolo quando MySQL local já está encerrado', () => {
    appendRecentOpenTicketsToStorage([
      ticket({ protocol: 1686776, status: 'aberta', ellevenLifecycle: 'open', closedAt: null }),
    ])
    pruneRecentOpensClosedByBff([], [
      {
        id: 1,
        protocol: 1686776,
        assignmentId: 1,
        accessPointCode: 'AP',
        title: 'OLT 04 - NHOPN',
        operatorEmail: 'op@test.com',
        affectedClients: 0,
        status: 'encerrada',
        openedAt: new Date(),
        expectedCloseAt: null,
        closedAt: new Date(),
        updatedAt: null,
      },
    ])
    expect(readRecentOpenTicketsFromStorage()).toHaveLength(0)
  })
})
