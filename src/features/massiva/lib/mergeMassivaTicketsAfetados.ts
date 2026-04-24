import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

export type MassivaAfetadoProtocolEnrichment = {
  count: number | null
  estimateTimeOfRestoration: number | null
}

/**
 * Aplica o GET `…/afetados/protocol/{id}`: total de afetados e, quando exposto, `estimateTimeOfRestoration` (horas)
 * (frequentemente só neste corpo, ex. `data.impactedUsers`).
 */
export function mergeMassivaTicketsAfetados(
  tickets: MassivaTicket[],
  byProtocol: Map<number, MassivaAfetadoProtocolEnrichment>,
): MassivaTicket[] {
  if (byProtocol.size === 0) return tickets
  return tickets.map((t) => {
    if (t.protocol <= 0) return t
    const e = byProtocol.get(t.protocol)
    if (e === undefined) return t

    const next: MassivaTicket = { ...t }
    if (e.count !== null && e.count >= 0) {
      next.affectedClients = e.count
    }
    if (e.estimateTimeOfRestoration !== null) {
      next.estimateTimeOfRestoration = e.estimateTimeOfRestoration
    }
    return next
  })
}
