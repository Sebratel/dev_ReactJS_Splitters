import {
  effectiveMassivaStatus,
} from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import {
  readRecentOpenTicketsFromStorage,
  removeRecentOpenTicketFromStorage,
} from '@/features/massiva/lib/massivaRecentOpensStorage'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function ellevenSaysClosed(ticket: MassivaTicket): boolean {
  return (
    ticket.ellevenLifecycle === 'closed' || effectiveMassivaStatus(ticket) === 'encerrada'
  )
}

/** Remove do sessionStorage protocolos que o Elleven já encerrou/cancelou. */
export function pruneRecentOpensClosedByBff(bffTickets: readonly MassivaTicket[]): void {
  if (typeof window === 'undefined' || bffTickets.length === 0) return

  const recent = readRecentOpenTicketsFromStorage()
  if (recent.length === 0) return

  const bffByProtocol = new Map<number, MassivaTicket>()
  for (const ticket of bffTickets) {
    if (ticket.protocol > 0) {
      bffByProtocol.set(ticket.protocol, ticket)
    }
  }

  for (const entry of recent) {
    const bff = bffByProtocol.get(entry.protocol)
    if (bff != null && ellevenSaysClosed(bff)) {
      removeRecentOpenTicketFromStorage(entry.protocol)
    }
  }
}
