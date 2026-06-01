import { describe, expect, it } from 'vitest'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { resolveAffectedClientsForMergedTicket } from '@/features/massiva/lib/massivaTicketAffectedClients'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const periodStart = new Date('2026-05-01T00:00:00.000Z')

describe('resolveAffectedClientsForMergedTicket', () => {
  it('encerrada usa afetados do MySQL', () => {
    const merged = { ellevenLifecycle: 'closed', status: 'encerrada' } as MassivaTicket
    expect(
      resolveAffectedClientsForMergedTicket({
        localRow: { affectedClients: 42 } as MassivaHistoryListRow,
        local: null,
        bff: { affectedClients: 0 } as MassivaTicket,
        merged,
      }),
    ).toBe(42)
  })

  it('aberta prioriza afetados do Elleven', () => {
    const merged = { ellevenLifecycle: 'open', status: 'aberta' } as MassivaTicket
    expect(
      resolveAffectedClientsForMergedTicket({
        localRow: { affectedClients: 5 } as MassivaHistoryListRow,
        local: null,
        bff: { affectedClients: 18 } as MassivaTicket,
        merged,
      }),
    ).toBe(18)
  })
})

describe('buildDashboardMassivaTickets affected clients', () => {
  it('encerrada no MySQL mantém afetados mesmo com BFF zerado', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        {
          protocol: 1,
          assignmentId: 1,
          title: 'Registro Incidente de Rede',
          description: '',
          apCode: 'AP',
          splitterCode: '',
          team: '',
          createdBy: '',
          responsible: '',
          status: 'encerrada',
          ellevenLifecycle: 'closed',
          ellevenIncidentStatusId: null,
          ellevenStatusTexts: [],
          openedAt: new Date('2026-05-10T10:00:00.000Z'),
          expectedCloseAt: null,
          previsaoEncerramentoAtualizadaPor: '',
          estimateTimeOfRestoration: null,
          closedAt: new Date('2026-05-11T10:00:00.000Z'),
          affectedClients: 0,
          affectedClientsResidential: null,
          affectedClientsCorporate: null,
          usedFallback: false,
        },
      ],
      localRows: [
        {
          id: 1,
          protocol: 1,
          assignmentId: 1,
          accessPointCode: 'AP',
          title: 'Registro Incidente de Rede',
          operatorEmail: 'op@test.com',
          affectedClients: 37,
          status: 'encerrada',
          openedAt: new Date('2026-05-10T10:00:00.000Z'),
          expectedCloseAt: null,
          closedAt: new Date('2026-05-11T10:00:00.000Z'),
          updatedAt: null,
        },
      ],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.find((t) => t.protocol === 1)?.affectedClients).toBe(37)
  })

  it('não lista encerrada só no Elleven sem registro MySQL', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        {
          protocol: 99,
          assignmentId: 1,
          title: 'Registro Incidente de Rede',
          description: '',
          apCode: '',
          splitterCode: '',
          team: '',
          createdBy: '',
          responsible: '',
          status: 'encerrada',
          ellevenLifecycle: 'closed',
          ellevenIncidentStatusId: null,
          ellevenStatusTexts: [],
          openedAt: new Date('2026-05-10T10:00:00.000Z'),
          expectedCloseAt: null,
          previsaoEncerramentoAtualizadaPor: '',
          estimateTimeOfRestoration: null,
          closedAt: new Date('2026-05-11T10:00:00.000Z'),
          affectedClients: 0,
          affectedClientsResidential: null,
          affectedClientsCorporate: null,
          usedFallback: false,
        },
      ],
      localRows: [],
      recentOpenTickets: [],
      periodStart,
    })
    expect(merged.some((t) => t.protocol === 99)).toBe(false)
  })
})
