import {
  isMassivaClosedForCounts,
  isMassivaEligibleForDashboardCounts,
  isMassivaOpenForGlobalDashboard,
} from '@/features/massiva/lib/massivaDashboardEligibility'
import type { IntelligenceMassivaPeriodRollup } from '@/features/splitters/api/fetchMassivaPeriodRollupFromLocalDb'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

export function ticketOpenedInRange(
  ticket: MassivaTicket,
  range: { start: Date; end: Date },
): boolean {
  if (ticket.openedAt == null) return false
  const t = ticket.openedAt.getTime()
  return t >= range.start.getTime() && t <= range.end.getTime()
}

/** Agregado de período alinhado ao Elleven (BFF + histórico NexaView), substitui só MySQL quando há listagem. */
export function rollupMassivaPeriodFromTickets(
  tickets: readonly MassivaTicket[],
  range: { start: Date; end: Date },
  recentProtocols?: ReadonlySet<number>,
): IntelligenceMassivaPeriodRollup {
  const inPeriod = tickets.filter((ticket) => ticketOpenedInRange(ticket, range))

  let openMassivasCount = 0
  let closedMassivasCount = 0
  const distinctProtocols = new Set<number>()
  const affectedByProtocol = new Map<number, number>()

  for (const ticket of inPeriod) {
    if (!isMassivaEligibleForDashboardCounts(ticket, recentProtocols)) continue

    if (ticket.protocol > 0) {
      distinctProtocols.add(ticket.protocol)
      affectedByProtocol.set(
        ticket.protocol,
        Math.max(affectedByProtocol.get(ticket.protocol) ?? 0, Math.max(0, ticket.affectedClients)),
      )
    }

    if (isMassivaOpenForGlobalDashboard(ticket, recentProtocols)) {
      openMassivasCount += 1
      continue
    }
    if (isMassivaClosedForCounts(ticket)) {
      closedMassivasCount += 1
    }
  }

  const affectedClientsDistinctSum = [...affectedByProtocol.values()].reduce(
    (sum, value) => sum + value,
    0,
  )

  return {
    distinctMassivaCount: distinctProtocols.size,
    affectedClientsDistinctSum,
    openMassivasCount,
    closedMassivasCount,
  }
}
