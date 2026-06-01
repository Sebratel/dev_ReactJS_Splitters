import { describe, expect, it } from 'vitest'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const periodStart = new Date('2026-05-01T00:00:00.000Z')
const staleOpenedAt = new Date('2026-05-10T10:00:00.000Z')

function bff(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  const status = partial.status ?? 'aberta'
  return {
    protocol: partial.protocol,
    assignmentId: partial.assignmentId ?? null,
    title: partial.title ?? 'Chamado avulso XYZ',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status,
    ellevenLifecycle:
      partial.ellevenLifecycle ??
      (status === 'encerrada' ? 'closed' : status === 'aberta' ? 'open' : 'unknown'),
    ellevenIncidentStatusId: partial.ellevenIncidentStatusId ?? null,
    ellevenStatusTexts: partial.ellevenStatusTexts ?? [],
    openedAt: partial.openedAt ?? staleOpenedAt,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? null,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

function local(partial: Partial<MassivaHistoryListRow> & Pick<MassivaHistoryListRow, 'protocol'>): MassivaHistoryListRow {
  return {
    id: 1,
    protocol: partial.protocol,
    assignmentId: partial.assignmentId ?? 1,
    accessPointCode: 'AP',
    title: partial.title ?? 'OLT teste',
    operatorEmail: 'op@test.com',
    affectedClients: partial.affectedClients ?? 1,
    status: partial.status ?? 'aberta',
    openedAt: partial.openedAt ?? staleOpenedAt,
    expectedCloseAt: null,
    closedAt: partial.closedAt ?? null,
    updatedAt: null,
  }
}

describe('buildDashboardMassivaTickets', () => {
  it('mantém aberta local recente quando BFF só indica encerrada sem lifecycle closed', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 1676225,
          title: 'Registro Incidente de Rede',
          status: 'encerrada',
          ellevenLifecycle: 'unknown',
          closedAt: new Date(),
        }),
      ],
      localRows: [
        local({
          protocol: 1676225,
          title: 'Registro Incidente de Rede',
          openedAt: new Date(),
        }),
      ],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.find((t) => t.protocol === 1676225)?.status).toBe('aberta')
  })

  it('encerra no painel quando MySQL já está encerrado (afetados locais)', () => {
    const openedNow = new Date()
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 1676359,
          status: 'encerrada',
          ellevenLifecycle: 'closed',
          title: 'Registro Incidente de Rede',
          closedAt: openedNow,
          affectedClients: 0,
        }),
      ],
      localRows: [
        local({
          protocol: 1676359,
          status: 'encerrada',
          openedAt: openedNow,
          closedAt: openedNow,
          affectedClients: 12,
          title: 'Registro Incidente de Rede',
        }),
      ],
      recentOpenTickets: [],
      periodStart,
    })
    const ticket = merged.find((t) => t.protocol === 1676359)
    expect(ticket?.status).toBe('encerrada')
    expect(ticket?.affectedClients).toBe(12)
  })

  it('remove fantasma: local aberta antiga sem protocolo no BFF', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [],
      localRows: [local({ protocol: 555, openedAt: staleOpenedAt })],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.some((t) => t.protocol === 555)).toBe(false)
  })

  it('local aberta antiga vira encerrada quando BFF confirma encerrada', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [bff({ protocol: 777, status: 'encerrada', closedAt: new Date('2026-05-11') })],
      localRows: [local({ protocol: 777, openedAt: staleOpenedAt })],
      recentOpenTickets: [],
      periodStart,
    })
    const ticket = merged.find((t) => t.protocol === 777)
    expect(ticket?.status).toBe('encerrada')
  })

  it('não inclui encerrada de catálogo esperado só no Elleven', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 99,
          title: 'Registro Incidente de Rede',
          status: 'encerrada',
          ellevenLifecycle: 'closed',
          closedAt: new Date('2026-05-11T10:00:00.000Z'),
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.some((t) => t.protocol === 99)).toBe(false)
  })

  it('inclui BFF aberta fora do catálogo sem registro local (monitorização)', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 999,
          title: 'Chamado avulso XYZ',
          status: 'aberta',
          ellevenLifecycle: 'open',
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.some((t) => t.protocol === 999 && t.status === 'aberta')).toBe(true)
  })

  it('inclui BFF aberta com catálogo esperado sem registro local', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [bff({ protocol: 100, title: 'Registro Incidente de Rede' })],
      localRows: [],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.some((t) => t.protocol === 100 && t.status === 'aberta')).toBe(true)
  })

  it('não mantém como aberta BFF com ellevenLifecycle closed (mesmo status textual aberta)', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 888,
          status: 'aberta',
          ellevenLifecycle: 'closed',
          title: 'Registro Incidente de Rede',
        }),
      ],
      localRows: [local({ protocol: 888, openedAt: staleOpenedAt })],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.find((t) => t.protocol === 888)?.status).toBe('encerrada')
  })
})
