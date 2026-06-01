import { describe, expect, it } from 'vitest'
import { collectOpenMassivasForHomeDashboard } from '@/features/massiva/lib/collectOpenMassivasForHomeDashboard'
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
    ellevenLifecycle: partial.ellevenLifecycle ?? 'unknown',
    ellevenIncidentStatusId: null,
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
  it('inclui BFF aberta com lifecycle unknown (caso típico da Home)', () => {
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [bff({ protocol: 100, ellevenLifecycle: 'unknown', affectedClients: 12 })],
      localRows: [],
      recentOpenTickets: [],
    })
    expect(open).toHaveLength(1)
    expect(open[0]?.affectedClients).toBe(12)
  })

  it('exclui Elleven encerrado', () => {
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [bff({ protocol: 200, ellevenLifecycle: 'closed', status: 'encerrada' })],
      localRows: [],
      recentOpenTickets: [],
    })
    expect(open).toHaveLength(0)
  })

  it('inclui aberta só no MySQL local (sem BFF)', () => {
    const local: MassivaHistoryListRow = {
      id: 1,
      protocol: 1676225,
      assignmentId: 1,
      accessPointCode: 'AP',
      title: 'Registro Incidente de Rede',
      operatorEmail: 'op@test.com',
      affectedClients: 3,
      status: 'aberta',
      openedAt: new Date('2026-05-01T10:00:00'),
      expectedCloseAt: null,
      closedAt: null,
      updatedAt: null,
    }
    const open = collectOpenMassivasForHomeDashboard({
      bffTickets: [],
      localRows: [local],
      recentOpenTickets: [],
    })
    expect(open.some((t) => t.protocol === 1676225)).toBe(true)
  })
})
