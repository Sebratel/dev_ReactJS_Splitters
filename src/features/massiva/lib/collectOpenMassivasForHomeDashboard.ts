import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { applyEffectiveMassivaTicket, effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import { isMassivaOpenForGlobalDashboard } from '@/features/massiva/lib/massivaDashboardEligibility'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Janela larga: KPI da Home é “abertas agora”, não só últimos 7/30/90 dias. */
const HOME_DASHBOARD_PERIOD_START = new Date(2000, 0, 1)

function massivaTicketFromLocalOpenRow(row: MassivaHistoryListRow): MassivaTicket {
  return applyEffectiveMassivaTicket({
    protocol: row.protocol ?? 0,
    assignmentId: row.assignmentId,
    title: row.title.trim() !== '' ? row.title.trim() : 'Massiva',
    description: '',
    apCode: row.accessPointCode,
    splitterCode: '',
    team: '',
    createdBy: row.operatorEmail,
    responsible: '',
    status: 'aberta',
    ellevenLifecycle: 'open',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: row.openedAt,
    expectedCloseAt: row.expectedCloseAt,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: null,
    affectedClients: row.affectedClients,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  })
}

function recentProtocolSet(recentOpenTickets: readonly MassivaTicket[]): Set<number> {
  const set = new Set<number>()
  for (const ticket of recentOpenTickets) {
    if (ticket.protocol > 0) set.add(ticket.protocol)
  }
  return set
}

/**
 * Massivas abertas para cards da Home — mesma base do painel (BFF + MySQL + recentes),
 * com regra de “aberta” menos restritiva que a aba Abertas (aceita lifecycle unknown do BFF).
 */
export function collectOpenMassivasForHomeDashboard(input: {
  bffTickets: readonly MassivaTicket[]
  localRows: readonly MassivaHistoryListRow[]
  recentOpenTickets: readonly MassivaTicket[]
}): MassivaTicket[] {
  const recentProtocols = recentProtocolSet(input.recentOpenTickets)
  const bffByProtocol = new Map<number, MassivaTicket>()
  for (const bff of input.bffTickets) {
    if (bff.protocol > 0) {
      bffByProtocol.set(bff.protocol, applyEffectiveMassivaTicket(bff))
    }
  }

  const merged = buildDashboardMassivaTickets({
    bffTickets: input.bffTickets,
    localRows: input.localRows,
    recentOpenTickets: input.recentOpenTickets,
    periodStart: HOME_DASHBOARD_PERIOD_START,
  })

  const byProtocol = new Map<number, MassivaTicket>()

  for (const ticket of merged) {
    if (ticket.protocol <= 0) continue
    if (!isMassivaOpenForGlobalDashboard(ticket, recentProtocols)) continue
    byProtocol.set(ticket.protocol, ticket)
  }

  for (const bff of input.bffTickets) {
    if (bff.protocol <= 0 || byProtocol.has(bff.protocol)) continue
    const effective = applyEffectiveMassivaTicket(bff)
    if (!isMassivaOpenForGlobalDashboard(effective, recentProtocols)) continue
    byProtocol.set(bff.protocol, effective)
  }

  for (const recent of input.recentOpenTickets) {
    if (recent.protocol <= 0 || byProtocol.has(recent.protocol)) continue
    const bff = bffByProtocol.get(recent.protocol)
    if (
      bff &&
      (bff.ellevenLifecycle === 'closed' || effectiveMassivaStatus(bff) === 'encerrada')
    ) {
      continue
    }
    const effective = applyEffectiveMassivaTicket(
      bff != null
        ? { ...bff, openedAt: recent.openedAt ?? bff.openedAt }
        : {
            ...recent,
            status: 'aberta',
            ellevenLifecycle: 'open',
          },
    )
    if (!isMassivaOpenForGlobalDashboard(effective, recentProtocols)) continue
    byProtocol.set(recent.protocol, effective)
  }

  for (const row of input.localRows) {
    if (row.status !== 'aberta' || row.closedAt != null) continue
    const protocol = row.protocol
    if (protocol == null || protocol <= 0 || byProtocol.has(protocol)) continue
    const bff = bffByProtocol.get(protocol)
    if (
      bff &&
      (bff.ellevenLifecycle === 'closed' || effectiveMassivaStatus(bff) === 'encerrada')
    ) {
      continue
    }
    const fromLocal = massivaTicketFromLocalOpenRow(row)
    if (!isMassivaOpenForGlobalDashboard(fromLocal, recentProtocols)) continue
    byProtocol.set(protocol, fromLocal)
  }

  return [...byProtocol.values()].sort((a, b) => {
    const ta = a.openedAt?.getTime() ?? 0
    const tb = b.openedAt?.getTime() ?? 0
    return tb - ta
  })
}
