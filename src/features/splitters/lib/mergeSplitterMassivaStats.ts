import type { SplitterMassivaStats } from '@/features/splitters/model/splitterOperationalInsights'

const EMPTY: SplitterMassivaStats = {
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  affectedClientsTotal: 0,
  latestOpenedAt: null,
}

function latestDate(a: Date | null, b: Date | null): Date | null {
  if (a === null) return b
  if (b === null) return a
  return a.getTime() >= b.getTime() ? a : b
}

/**
 * MySQL (vínculos no período) + Elleven (abertas agora). Abertas vêm do BFF quando disponível.
 */
export function mergeSplitterMassivaStats(
  local: SplitterMassivaStats | undefined,
  fromTickets: SplitterMassivaStats | undefined,
): SplitterMassivaStats {
  const hasTicketSignal =
    fromTickets != null &&
    (fromTickets.totalTickets > 0 ||
      fromTickets.openTickets > 0 ||
      fromTickets.closedTickets > 0)

  if (!hasTicketSignal) return local ?? EMPTY
  if (!local || local.totalTickets === 0) return fromTickets!

  return {
    totalTickets: Math.max(local.totalTickets, fromTickets!.totalTickets),
    openTickets: fromTickets!.openTickets,
    closedTickets: Math.max(local.closedTickets, fromTickets!.closedTickets),
    affectedClientsTotal: Math.max(
      local.affectedClientsTotal,
      fromTickets!.affectedClientsTotal,
    ),
    latestOpenedAt: latestDate(local.latestOpenedAt, fromTickets!.latestOpenedAt),
  }
}
