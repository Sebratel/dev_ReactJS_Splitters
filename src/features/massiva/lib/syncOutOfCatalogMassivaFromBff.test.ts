import { describe, expect, it } from 'vitest'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import {
  bffSaysMassivaClosed,
  collectOutOfCatalogProtocolsForLocalCloseSync,
  collectProtocolsForLocalCloseSync,
  localRowExpectedCloseExpired,
} from '@/features/massiva/lib/syncOutOfCatalogMassivaFromBff'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const periodStart = new Date('2026-05-01T00:00:00.000Z')

function bff(partial: Partial<MassivaTicket> & Pick<MassivaTicket, 'protocol'>): MassivaTicket {
  return {
    protocol: partial.protocol,
    assignmentId: null,
    title: partial.title ?? 'OLT 04 - NHOPN',
    description: '',
    apCode: '',
    splitterCode: '',
    team: '',
    createdBy: '',
    responsible: '',
    status: partial.status ?? 'aberta',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: partial.ellevenStatusTexts ?? [],
    openedAt: partial.openedAt ?? new Date('2026-05-10T10:00:00.000Z'),
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

describe('syncOutOfCatalogMassivaFromBff', () => {
  it('detecta encerrado no BFF', () => {
    expect(
      bffSaysMassivaClosed(
        bff({ protocol: 1, status: 'encerrada', ellevenLifecycle: 'closed' }),
      ),
    ).toBe(true)
  })

  it('lista protocolos OOT para reconciliar MySQL aberta', () => {
    const protocols = collectOutOfCatalogProtocolsForLocalCloseSync(
      [bff({ protocol: 55, status: 'encerrada', ellevenLifecycle: 'closed' })],
      [
        {
          id: 1,
          protocol: 55,
          assignmentId: 1,
          accessPointCode: 'AP',
          title: 'OLT 04',
          operatorEmail: 'op@test.com',
          affectedClients: 1,
          status: 'aberta',
          openedAt: new Date(),
          expectedCloseAt: null,
          closedAt: null,
          updatedAt: null,
        } satisfies MassivaHistoryListRow,
      ],
    )
    expect(protocols).toEqual([55])
  })

  it('reconcilia catálogo quando BFF já encerrou', () => {
    const protocols = collectProtocolsForLocalCloseSync(
      [
        bff({
          protocol: 56,
          title: 'Registro Incidente de Rede',
          status: 'encerrada',
          ellevenLifecycle: 'closed',
        }),
      ],
      [
        {
          id: 1,
          protocol: 56,
          assignmentId: 1,
          accessPointCode: 'AP',
          title: 'Registro Incidente de Rede',
          operatorEmail: 'op@test.com',
          affectedClients: 1,
          status: 'aberta',
          openedAt: new Date(),
          expectedCloseAt: null,
          closedAt: null,
          updatedAt: null,
        },
      ],
    )
    expect(protocols).toEqual([56])
  })

  it('reconcilia MySQL aberta com previsão expirada (#1684421)', () => {
    const row = {
      id: 281,
      protocol: 1684421,
      assignmentId: 1,
      accessPointCode: '29370',
      title: 'OLT 02 - CANMV',
      operatorEmail: 'op@test.com',
      affectedClients: 4,
      status: 'aberta' as const,
      openedAt: new Date('2026-06-06T14:08:03-03:00'),
      expectedCloseAt: new Date('2025-06-06T18:00:00-03:00'),
      closedAt: null,
      updatedAt: null,
    }
    expect(localRowExpectedCloseExpired(row)).toBe(true)
    expect(
      collectProtocolsForLocalCloseSync(
        [bff({ protocol: 1686865, title: 'OLT 02 - NHOCE', ellevenLifecycle: 'open' })],
        [row],
      ),
    ).toEqual([1684421])
  })
})

describe('buildDashboardMassivaTickets out-of-catalog BFF status', () => {
  it('inclui encerrada fora do catálogo só no Elleven (status do BFF)', () => {
    const merged = buildDashboardMassivaTickets({
      bffTickets: [
        bff({
          protocol: 99,
          status: 'encerrada',
          ellevenLifecycle: 'closed',
          closedAt: new Date('2026-05-11T10:00:00.000Z'),
        }),
      ],
      localRows: [],
      recentOpenTickets: [],
      periodStart,
    })
    const ticket = merged.find((t) => t.protocol === 99)
    expect(ticket?.status).toBe('encerrada')
    expect(ticket?.ellevenLifecycle).toBe('closed')
  })
})
