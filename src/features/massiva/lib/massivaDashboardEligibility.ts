import { effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import { isMassivaMonitoringOutOfCatalogTitle } from '@/features/massiva/lib/massivaCatalogTitle'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Exclui chamados avulsos que o painel não lista como massiva de catálogo. */
export function isMassivaEligibleForDashboardCounts(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (recentProtocols?.has(ticket.protocol)) return true
  return !isMassivaMonitoringOutOfCatalogTitle(ticket.title)
}

/**
 * Cards da Home e visão global: BFF costuma vir sem `incidentStatusId` (lifecycle unknown)
 * mas com status textual aberto — ainda assim deve entrar na contagem.
 */
export function isMassivaOpenForGlobalDashboard(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (!isMassivaEligibleForDashboardCounts(ticket, recentProtocols)) return false
  if (effectiveMassivaStatus(ticket) !== 'aberta') return false
  if (ticket.ellevenLifecycle === 'closed') return false
  if (ticket.ellevenLifecycle === 'open') return true
  if (ticket.ellevenLifecycle === 'unknown') return true
  return recentProtocols?.has(ticket.protocol) ?? false
}

/**
 * Regras alinhadas à aba Abertas do painel (Elleven + aberturas recentes no NexaView).
 */
export function isMassivaOpenForCounts(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (!isMassivaEligibleForDashboardCounts(ticket, recentProtocols)) return false
  if (effectiveMassivaStatus(ticket) !== 'aberta') return false
  if (ticket.ellevenLifecycle === 'closed') return false
  if (
    ticket.ellevenLifecycle === 'unknown' &&
    !recentProtocols?.has(ticket.protocol)
  ) {
    return false
  }
  return true
}

export function isMassivaClosedForCounts(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (!isMassivaEligibleForDashboardCounts(ticket, recentProtocols)) return false
  return effectiveMassivaStatus(ticket) === 'encerrada'
}

/**
 * Listagem do painel (aba Abertas): inclui abertas fora do catálogo (Elleven) para monitorização.
 * KPIs continuam em `isMassivaOpenForCounts`.
 */
export function isMassivaOpenForPanelList(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (effectiveMassivaStatus(ticket) !== 'aberta') return false
  if (ticket.ellevenLifecycle === 'closed') return false
  if (isMassivaMonitoringOutOfCatalogTitle(ticket.title)) {
    return ticket.ellevenLifecycle === 'open' || ticket.ellevenLifecycle === 'unknown'
  }
  return isMassivaOpenForGlobalDashboard(ticket, recentProtocols)
}

/** Listagem do painel (aba Encerradas): encerradas fora do catálogo também aparecem. */
export function isMassivaClosedForPanelList(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (effectiveMassivaStatus(ticket) !== 'encerrada') return false
  if (isMassivaMonitoringOutOfCatalogTitle(ticket.title)) return true
  return isMassivaClosedForCounts(ticket, recentProtocols)
}

export function isMassivaCancelledForCounts(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (!isMassivaEligibleForDashboardCounts(ticket, recentProtocols)) return false
  return effectiveMassivaStatus(ticket) === 'cancelada'
}

/** Listagem do painel (aba Canceladas): canceladas fora do catálogo também aparecem. */
export function isMassivaCancelledForPanelList(
  ticket: MassivaTicket,
  recentProtocols?: ReadonlySet<number>,
): boolean {
  if (effectiveMassivaStatus(ticket) !== 'cancelada') return false
  if (isMassivaMonitoringOutOfCatalogTitle(ticket.title)) return true
  return isMassivaCancelledForCounts(ticket, recentProtocols)
}

export function ticketOpenedInDashboardPeriod(
  ticket: MassivaTicket,
  periodStart: Date,
): boolean {
  if (ticket.openedAt == null) return false
  return ticket.openedAt.getTime() >= periodStart.getTime()
}

export type MassivaPeriodCountSummary = {
  totalProtocols: number
  openCount: number
  closedCount: number
  unknownCount: number
}

type ProtocolPeriodBucket = 'open' | 'closed' | 'unknown'

export function summarizeMassivaPeriodCounts(
  tickets: readonly MassivaTicket[],
  options?: { recentProtocols?: ReadonlySet<number> },
): MassivaPeriodCountSummary {
  const bucketByProtocol = new Map<number, ProtocolPeriodBucket>()

  for (const ticket of tickets) {
    if (ticket.protocol <= 0) continue
    if (!isMassivaEligibleForDashboardCounts(ticket, options?.recentProtocols)) continue

    let bucket: ProtocolPeriodBucket = 'unknown'
    if (isMassivaOpenForCounts(ticket, options?.recentProtocols)) {
      bucket = 'open'
    } else if (isMassivaClosedForCounts(ticket, options?.recentProtocols)) {
      bucket = 'closed'
    }

    const existing = bucketByProtocol.get(ticket.protocol)
    if (existing === 'closed') continue
    if (existing === 'open' && bucket === 'unknown') continue
    bucketByProtocol.set(ticket.protocol, bucket)
  }

  let openCount = 0
  let closedCount = 0
  let unknownCount = 0
  for (const bucket of bucketByProtocol.values()) {
    if (bucket === 'open') openCount += 1
    else if (bucket === 'closed') closedCount += 1
    else unknownCount += 1
  }

  return {
    totalProtocols: openCount + closedCount + unknownCount,
    openCount,
    closedCount,
    unknownCount,
  }
}
