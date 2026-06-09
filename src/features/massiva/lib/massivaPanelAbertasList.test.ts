import { describe, expect, it } from 'vitest'
import {
  collectMassivaPanelAbertasTickets,
  matchesMassivaPanelCatalogFilter,
} from '@/features/massiva/lib/massivaPanelAbertasList'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function bff(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  return {
    protocol: partial.protocol,
    assignmentId: null,
    title: partial.title ?? 'Registro Incidente de Rede',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: partial.openedAt ?? new Date(),
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: partial.affectedClients ?? 1,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('matchesMassivaPanelCatalogFilter', () => {
  it('filtro all exclui título OLT', () => {
    expect(matchesMassivaPanelCatalogFilter(bff({ protocol: 1, title: 'OLT 02 - NHOCE' }), 'all')).toBe(
      false,
    )
    expect(
      matchesMassivaPanelCatalogFilter(
        bff({ protocol: 2, title: 'Registro Evento Massivo' }),
        'all',
      ),
    ).toBe(true)
  })
})

describe('collectMassivaPanelAbertasTickets', () => {
  it('catálogo com lifecycle unknown entra (regra global do painel)', () => {
    const row = bff({
      protocol: 42,
      ellevenLifecycle: 'unknown',
      title: 'Registro Incidente de Rede',
    })
    expect(
      collectMassivaPanelAbertasTickets({
        bffTickets: [row],
        localRows: [],
        recentOpenTickets: [],
      }),
    ).toHaveLength(1)
  })
})
