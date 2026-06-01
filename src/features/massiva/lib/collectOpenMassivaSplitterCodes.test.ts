import { describe, expect, it } from 'vitest'
import { collectOpenMassivaSplitterCodes } from '@/features/massiva/lib/collectOpenMassivaSplitterCodes'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ticket(partial: Partial<MassivaTicket>): MassivaTicket {
  return {
    protocol: partial.protocol ?? 1,
    assignmentId: null,
    title: partial.title ?? 'Registro Incidente de Rede',
    description: '',
    apCode: partial.apCode ?? '',
    splitterCode: partial.splitterCode ?? 'SPL-A',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: partial.ellevenStatusTexts ?? [],
    openedAt: new Date(),
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('collectOpenMassivaSplitterCodes', () => {
  it('ignora ticket encerrado no Elleven mesmo com splitter', () => {
    const codes = collectOpenMassivaSplitterCodes({
      openTicketsNow: [],
      dashboardTickets: [
        ticket({ splitterCode: 'SPL-OLD', ellevenLifecycle: 'closed', status: 'encerrada' }),
      ],
      recentProtocolSet: new Set(),
    })
    expect(codes).toEqual([])
  })

  it('inclui splitter só quando massiva está aberta no Elleven', () => {
    const codes = collectOpenMassivaSplitterCodes({
      openTicketsNow: [ticket({ splitterCode: 'SPL-1' })],
      dashboardTickets: [ticket({ splitterCode: 'SPL-2', ellevenLifecycle: 'unknown', status: 'aberta' })],
      recentProtocolSet: new Set(),
    })
    expect(codes.sort()).toEqual(['SPL-1', 'SPL-2'])
  })

  it('não inclui código quando massiva aberta só tem AP (sem splitter no ticket)', () => {
    const codes = collectOpenMassivaSplitterCodes({
      openTicketsNow: [ticket({ splitterCode: '', apCode: '25903', protocol: 99 })],
      dashboardTickets: [],
      recentProtocolSet: new Set(),
    })
    expect(codes).toEqual([])
  })
})
