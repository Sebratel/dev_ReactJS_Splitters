import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { buildDashboardMassivaTickets } from '@/features/massiva/lib/buildDashboardMassivaTickets'
import {
  isExpectedMassivaCatalogTitle,
  isMassivaMonitoringOutOfCatalogTitle,
  isMassivaStandardFlowCatalogTitle,
} from '@/features/massiva/lib/massivaCatalogTitle'
import {
  isMassivaOpenForGlobalDashboard,
  isMassivaOpenForPanelList,
  ticketOpenedInDashboardPeriod,
} from '@/features/massiva/lib/massivaDashboardEligibility'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Mesmo padrão da aba Abertas no painel (`readMassivaTicketsUiState`). */
export const MASSIVA_PANEL_DEFAULT_PERIOD_DAYS = 30

export type MassivaPanelCatalogFilter = 'all' | 'catalogo_esperado' | 'fora_catalogo'
export type MassivaPanelRecordTypeFilter = 'all' | 'incidente' | 'evento'
export type MassivaPanelImpactRange = 'all' | 'none' | 'low' | 'medium' | 'high'

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function massivaPanelPeriodStart(
  days: number = MASSIVA_PANEL_DEFAULT_PERIOD_DAYS,
  now: Date = new Date(),
): Date {
  return startOfDay(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000))
}

function recentProtocolSet(recentOpenTickets: readonly MassivaTicket[]): Set<number> {
  const set = new Set<number>()
  for (const ticket of recentOpenTickets) {
    if (ticket.protocol > 0) set.add(ticket.protocol)
  }
  return set
}

function classifyMassivaRecordType(ticket: MassivaTicket): MassivaPanelRecordTypeFilter {
  const source = `${ticket.title} ${ticket.description}`.trim().toLowerCase()
  if (source.includes('incidente massivo') || source.includes('incidente')) return 'incidente'
  if (source.includes('evento massivo') || source.includes('evento')) return 'evento'
  return 'all'
}

function matchesRecordType(
  ticket: MassivaTicket,
  typeFilter: MassivaPanelRecordTypeFilter,
): boolean {
  if (typeFilter === 'all') return true
  return classifyMassivaRecordType(ticket) === typeFilter
}

export function matchesMassivaPanelCatalogFilter(
  ticket: MassivaTicket,
  catalogFilter: MassivaPanelCatalogFilter,
): boolean {
  if (catalogFilter === 'fora_catalogo') {
    return isMassivaMonitoringOutOfCatalogTitle(ticket.title)
  }
  if (catalogFilter === 'catalogo_esperado') {
    return isExpectedMassivaCatalogTitle(ticket.title)
  }
  return isMassivaStandardFlowCatalogTitle(ticket.title)
}

function matchesImpactRange(ticket: MassivaTicket, range: MassivaPanelImpactRange): boolean {
  const affected = ticket.affectedClients
  if (range === 'all') return true
  if (range === 'none') return affected <= 0
  if (range === 'low') return affected > 0 && affected <= 100
  if (range === 'medium') return affected > 100 && affected <= 500
  return affected > 500
}

function applyHistoryAffectedOverlay(
  tickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[],
): MassivaTicket[] {
  const historyAffectedByProtocol = new Map<number, number>()
  for (const row of localRows) {
    const protocol = row.protocol
    if (protocol === null || protocol <= 0) continue
    historyAffectedByProtocol.set(
      protocol,
      Math.max(historyAffectedByProtocol.get(protocol) ?? 0, row.affectedClients),
    )
  }

  return tickets.map((ticket) => {
    if (ticket.protocol <= 0) return ticket
    const historical = historyAffectedByProtocol.get(ticket.protocol)
    if (historical == null || historical === ticket.affectedClients) return ticket
    return { ...ticket, affectedClients: Math.max(ticket.affectedClients, historical) }
  })
}

export type CollectMassivaPanelAbertasTicketsOptions = {
  periodDays?: number
  catalogFilter?: MassivaPanelCatalogFilter
  recordTypeFilter?: MassivaPanelRecordTypeFilter
  impactRange?: MassivaPanelImpactRange
  query?: string
}

/**
 * Espelho da listagem da aba **Abertas** em `MassivaTicketsSection` (filtros padrão:
 * período 30d, catálogo «todos» do fluxo NexaView, tipo «todos», impacto «todos», sem busca).
 */
export function collectMassivaPanelAbertasTickets(
  input: {
    bffTickets: readonly MassivaTicket[]
    localRows: readonly MassivaHistoryListRow[]
    recentOpenTickets: readonly MassivaTicket[]
  },
  options?: CollectMassivaPanelAbertasTicketsOptions,
): MassivaTicket[] {
  const periodDays = options?.periodDays ?? MASSIVA_PANEL_DEFAULT_PERIOD_DAYS
  const periodStart = massivaPanelPeriodStart(periodDays)
  const catalogFilter = options?.catalogFilter ?? 'all'
  const recordTypeFilter = options?.recordTypeFilter ?? 'all'
  const impactRange = options?.impactRange ?? 'all'
  const query = (options?.query ?? '').trim().toLowerCase()
  const recentProtocols = recentProtocolSet(input.recentOpenTickets)

  const merged = buildDashboardMassivaTickets({
    bffTickets: input.bffTickets,
    localRows: input.localRows,
    recentOpenTickets: input.recentOpenTickets,
    periodStart,
  })

  const scoped = merged.filter((ticket) => {
    if (ticket.protocol <= 0) return false
    if (catalogFilter === 'fora_catalogo') {
      return isMassivaOpenForPanelList(ticket, recentProtocols)
    }
    return isMassivaOpenForGlobalDashboard(ticket, recentProtocols)
  })

  const inWindow = scoped.filter((ticket) =>
    ticketOpenedInDashboardPeriod(ticket, periodStart),
  )

  const withAffected = applyHistoryAffectedOverlay(inWindow, input.localRows)

  const filtered = withAffected.filter((ticket) => {
    if (!matchesRecordType(ticket, recordTypeFilter)) return false
    if (!matchesMassivaPanelCatalogFilter(ticket, catalogFilter)) return false
    if (!matchesImpactRange(ticket, impactRange)) return false
    if (query === '') return true
    const haystack = [
      ticket.title,
      ticket.apCode,
      ticket.splitterCode,
      ticket.createdBy,
      ticket.responsible,
      String(ticket.protocol),
    ]
      .join(' ')
      .trim()
      .toLowerCase()
    return haystack.includes(query)
  })

  return [...filtered].sort((a, b) => {
    const ta = a.openedAt?.getTime() ?? 0
    const tb = b.openedAt?.getTime() ?? 0
    return tb - ta
  })
}
