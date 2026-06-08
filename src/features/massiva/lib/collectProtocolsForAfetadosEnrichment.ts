import { effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/**
 * Protocolos que ainda precisam do GET `…/afetados/protocol/{id}`.
 * Encerradas usam afetados do MySQL / listagem; o endpoint costuma 404 no histórico.
 */
export function collectProtocolsForAfetadosEnrichment(
  tickets: readonly MassivaTicket[],
): number[] {
  const unique = new Set<number>()
  for (const ticket of tickets) {
    if (!Number.isFinite(ticket.protocol) || ticket.protocol <= 0) continue
    if (effectiveMassivaStatus(ticket) !== 'aberta') continue
    if (ticket.ellevenLifecycle === 'closed') continue
    unique.add(Math.trunc(ticket.protocol))
  }
  return [...unique].sort((a, b) => a - b)
}

export function protocolsFingerprintForAfetadosEnrichment(
  tickets: MassivaTicket[] | undefined,
): string {
  if (tickets == null || tickets.length === 0) return ''
  const protocols = collectProtocolsForAfetadosEnrichment(tickets)
  if (protocols.length === 0) return ''
  return protocols.join(',')
}
