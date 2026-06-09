import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import {
  effectiveMassivaStatus,
} from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import {
  readRecentOpenTicketsFromStorage,
  removeRecentOpenTicketFromStorage,
} from '@/features/massiva/lib/massivaRecentOpensStorage'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Após abertura, o catálogo Elleven pode demorar a listar o protocolo. */
const RECENT_OPEN_MISSING_FROM_BFF_GRACE_MS = 2 * 60 * 60 * 1000

function ellevenSaysClosed(ticket: MassivaTicket): boolean {
  return (
    ticket.ellevenLifecycle === 'closed' || effectiveMassivaStatus(ticket) === 'encerrada'
  )
}

function localRowSaysClosed(row: MassivaHistoryListRow): boolean {
  return row.status === 'encerrada' || row.closedAt != null
}

/** Remove do sessionStorage entradas obsoletas (Elleven encerrou, MySQL encerrou ou sumiu do catálogo). */
export function pruneRecentOpensClosedByBff(
  bffTickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[] = [],
): void {
  if (typeof window === 'undefined') return

  const recent = readRecentOpenTicketsFromStorage()
  if (recent.length === 0) return

  const bffByProtocol = new Map<number, MassivaTicket>()
  for (const ticket of bffTickets) {
    if (ticket.protocol > 0) {
      bffByProtocol.set(ticket.protocol, ticket)
    }
  }

  const localByProtocol = new Map<number, MassivaHistoryListRow>()
  for (const row of localRows) {
    const protocol = row.protocol
    if (protocol != null && protocol > 0) {
      localByProtocol.set(protocol, row)
    }
  }

  const bffCatalogLoaded = bffTickets.length > 0
  const now = Date.now()

  for (const entry of recent) {
    const protocol = entry.protocol
    if (protocol <= 0) continue

    const bff = bffByProtocol.get(protocol)
    if (bff != null && ellevenSaysClosed(bff)) {
      removeRecentOpenTicketFromStorage(protocol)
      continue
    }

    const local = localByProtocol.get(protocol)
    if (local != null && localRowSaysClosed(local)) {
      removeRecentOpenTicketFromStorage(protocol)
      continue
    }

    if (!bffCatalogLoaded || bff != null) continue

    const openedAt = entry.openedAt
    if (
      openedAt != null &&
      !Number.isNaN(openedAt.getTime()) &&
      now - openedAt.getTime() > RECENT_OPEN_MISSING_FROM_BFF_GRACE_MS
    ) {
      removeRecentOpenTicketFromStorage(protocol)
    }
  }
}
