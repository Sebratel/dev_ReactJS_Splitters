import { describe, expect, it } from 'vitest'
import { collectOpenMassivasForHomeDashboard } from '@/features/massiva/lib/collectOpenMassivasForHomeDashboard'
import { collectMassivaPanelAbertasTickets } from '@/features/massiva/lib/massivaPanelAbertasList'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
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
    affectedClients: partial.affectedClients ?? 5,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

describe('collectOpenMassivasForHomeDashboard', () => {
  it('espelha collectMassivaPanelAbertasTickets', () => {
    const input = {
      bffTickets: [bff({ protocol: 100, ellevenLifecycle: 'open', affectedClients: 12 })],
      localRows: [] as MassivaHistoryListRow[],
      recentOpenTickets: [] as MassivaTicket[],
    }
    expect(collectOpenMassivasForHomeDashboard(input)).toEqual(
      collectMassivaPanelAbertasTickets(input),
    )
  })

  it('não inclui OLT fora do catálogo (filtro padrão do painel)', () => {
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [
        bff({
          protocol: 1686865,
          title: 'OLT 02 - NHOCE',
          ellevenLifecycle: 'open',
          affectedClients: 7,
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
    })
    expect(open).toHaveLength(0)
  })

  it('inclui catálogo aberto no período', () => {
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [
        bff({
          protocol: 200,
          title: 'Registro Evento Massivo',
          ellevenLifecycle: 'open',
          openedAt: new Date(),
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
    })
    expect(open).toHaveLength(1)
    expect(open[0]?.protocol).toBe(200)
  })

  it('exclui Elleven encerrado', () => {
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [
        bff({
          protocol: 300,
          status: 'encerrada',
          ellevenLifecycle: 'closed',
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
    })
    expect(open).toHaveLength(0)
  })
})
