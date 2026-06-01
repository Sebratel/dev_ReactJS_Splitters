import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { effectiveMassivaStatus } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function isClosedTicket(ticket: MassivaTicket): boolean {
  return (
    ticket.ellevenLifecycle === 'closed' || effectiveMassivaStatus(ticket) === 'encerrada'
  )
}

/**
 * Encerradas: afetados do MySQL (`massiva_history`).
 * Abertas: Elleven (BFF), com fallback no histórico local.
 */
export function resolveAffectedClientsForMergedTicket(input: {
  localRow: MassivaHistoryListRow | null
  local: MassivaTicket | null
  bff: MassivaTicket | null
  merged: MassivaTicket
}): number {
  const localCount = Math.max(
    0,
    input.localRow?.affectedClients ?? input.local?.affectedClients ?? 0,
  )
  const bffCount = Math.max(0, input.bff?.affectedClients ?? 0)

  if (isClosedTicket(input.merged)) {
    if (input.localRow != null || input.local != null) return localCount
    return bffCount
  }

  if (bffCount > 0) return bffCount
  return localCount
}
