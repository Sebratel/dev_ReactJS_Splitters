import { isMassivaOpenForGlobalDashboard } from '@/features/massiva/lib/massivaDashboardEligibility'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/**
 * Códigos de splitter com massiva realmente aberta (Elleven), para filtros da lista.
 * Não usa MySQL `status = 'aberta'` — evita dezenas de equipamentos “fantasma”.
 */
export function collectOpenMassivaSplitterCodes(input: {
  openTicketsNow: readonly MassivaTicket[]
  dashboardTickets: readonly MassivaTicket[]
  recentProtocolSet: ReadonlySet<number>
}): string[] {
  const codes = new Set<string>()

  const addFromTicket = (ticket: MassivaTicket) => {
    if (!isMassivaOpenForGlobalDashboard(ticket, input.recentProtocolSet)) return
    const code = String(ticket.splitterCode ?? '').trim()
    if (code !== '') codes.add(code)
  }

  for (const ticket of input.openTicketsNow) {
    addFromTicket(ticket)
  }
  for (const ticket of input.dashboardTickets) {
    addFromTicket(ticket)
  }

  return [...codes]
}
