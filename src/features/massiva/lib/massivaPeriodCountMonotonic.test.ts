import { describe, expect, it } from 'vitest'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import {
  isMassivaEligibleForDashboardCounts,
  summarizeMassivaPeriodCounts,
  ticketOpenedInDashboardPeriod,
} from '@/features/massiva/lib/massivaDashboardEligibility'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

const openedMidWindow = new Date('2026-05-10T12:00:00.000Z')
const openedBefore30dOnly = new Date('2026-04-15T12:00:00.000Z')
const period30 = new Date('2026-05-01T00:00:00.000Z')
const period90 = new Date('2026-04-01T00:00:00.000Z')

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
    status: partial.status ?? 'encerrada',
    ellevenLifecycle: partial.ellevenLifecycle ?? 'closed',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: partial.openedAt ?? openedMidWindow,
    expectedCloseAt: null,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: partial.closedAt ?? openedMidWindow,
    affectedClients: 0,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  }
}

function local(
  partial: Partial<MassivaHistoryListRow> & Pick<MassivaHistoryListRow, 'protocol'>,
): MassivaHistoryListRow {
  return {
    id: 1,
    protocol: partial.protocol,
    assignmentId: 1,
    accessPointCode: 'AP',
    title: partial.title ?? 'Registro Incidente de Rede',
    operatorEmail: 'op@test.com',
    affectedClients: 1,
    status: partial.status ?? 'encerrada',
    openedAt: partial.openedAt ?? openedMidWindow,
    expectedCloseAt: null,
    closedAt: partial.closedAt ?? openedMidWindow,
    updatedAt: null,
  }
}

function countEligibleInPeriod(tickets: MassivaTicket[], periodStart: Date): number {
  const inPeriod = tickets.filter((t) => ticketOpenedInDashboardPeriod(t, periodStart))
  const eligible = inPeriod.filter((t) => isMassivaEligibleForDashboardCounts(t))
  return summarizeMassivaPeriodCounts(eligible).totalProtocols
}

describe('massiva period counts monotonic', () => {
  it('90d inclui no mínimo os protocolos elegíveis de 30d', () => {
    const bffTickets = [
      bff({
        protocol: 500,
        openedAt: openedMidWindow,
        closedAt: openedMidWindow,
        ellevenLifecycle: 'closed',
      }),
      bff({
        protocol: 501,
        openedAt: openedBefore30dOnly,
        closedAt: openedBefore30dOnly,
        ellevenLifecycle: 'closed',
      }),
    ]
    const localRows = [
      local({ protocol: 500, openedAt: openedMidWindow, closedAt: openedMidWindow }),
      local({
        protocol: 501,
        openedAt: openedBefore30dOnly,
        closedAt: openedBefore30dOnly,
      }),
    ]

    const merged90 = buildDashboardMassivaTickets({
      bffTickets,
      localRows,
      recentOpenTickets: [],
      periodStart: period90,
    })
    const merged30 = buildDashboardMassivaTickets({
      bffTickets,
      localRows,
      recentOpenTickets: [],
      periodStart: period30,
    })

    const count90 = countEligibleInPeriod(merged90, period90)
    const count30 = countEligibleInPeriod(merged30, period30)
    expect(count90).toBeGreaterThanOrEqual(count30)
    expect(count30).toBe(1)
    expect(count90).toBe(2)
  })
})
