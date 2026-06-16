import { describe, expect, it } from 'vitest'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import {
  bffSaysMassivaClosed,
  collectOutOfCatalogProtocolsForLocalCloseSync,
  collectProtocolsForLocalCloseSync,
  localRowExpectedCloseExpired,
  LOCAL_CLOSE_EXPIRED_PREVISAO_GRACE_MS,
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

  it('localRowExpectedCloseExpired detecta previsão expirada', () => {
    const expiredRow = {
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
    expect(localRowExpectedCloseExpired(expiredRow)).toBe(true)
  })

  it('previsão expirada sozinha NÃO fecha localmente sem confirmação do Elleven (#1689210)', () => {
    // Protocolo com SLA vencido mas Elleven ainda mostrando "Abertura" (finalizado: null).
    // Se fechássemos localmente, o DELETE no Elleven nunca seria chamado e os afetados
    // continuariam na tabela sem limpeza.
    const expiredRow: MassivaHistoryListRow = {
      id: 300,
      protocol: 1689210,
      assignmentId: 2054064,
      accessPointCode: 'OLT 01 - SLESC',
      title: 'Registro Evento Massivo',
      operatorEmail: 'gustavo.dutra@sebratel.com.br',
      affectedClients: 44,
      status: 'aberta',
      openedAt: new Date('2026-06-10T03:34:10.233812'),
      expectedCloseAt: new Date('2026-06-10T11:00:00'),
      closedAt: null,
      updatedAt: null,
    }
    // Elleven ainda responde como aberto (finalizado: null, status: "Abertura")
    const ellevenStillOpen = bff({ protocol: 1689210, status: 'aberta', ellevenLifecycle: 'open' })
    expect(localRowExpectedCloseExpired(expiredRow, Date.now())).toBe(true)
    expect(
      collectProtocolsForLocalCloseSync([ellevenStillOpen], [expiredRow]),
    ).toEqual([])
  })

  it('fecha localmente quando protocolo sumiu do BFF há mais de ' + LOCAL_CLOSE_EXPIRED_PREVISAO_GRACE_MS / 3600000 + 'h', () => {
    const oldRow: MassivaHistoryListRow = {
      id: 282,
      protocol: 1684421,
      assignmentId: 1,
      accessPointCode: '29370',
      title: 'OLT 02 - CANMV',
      operatorEmail: 'op@test.com',
      affectedClients: 4,
      status: 'aberta',
      openedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      expectedCloseAt: null,
      closedAt: null,
      updatedAt: null,
    }
    // Protocolo 1684421 não aparece no BFF (sumiu do catálogo)
    expect(
      collectProtocolsForLocalCloseSync(
        [bff({ protocol: 1686865, title: 'OLT 02 - NHOCE', ellevenLifecycle: 'open' })],
        [oldRow],
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
