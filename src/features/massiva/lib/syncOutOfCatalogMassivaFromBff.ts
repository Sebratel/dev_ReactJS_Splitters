import {
  effectiveMassivaStatus,
} from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { isMassivaMonitoringOutOfCatalogTitle } from '@/features/massiva/lib/massivaCatalogTitle'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Elleven/BFF indica protocolo encerrado ou cancelado. */
export function bffSaysMassivaClosed(ticket: MassivaTicket): boolean {
  return (
    ticket.ellevenLifecycle === 'closed' || effectiveMassivaStatus(ticket) === 'encerrada'
  )
}

export function bffSaysMassivaOpen(ticket: MassivaTicket): boolean {
  if (bffSaysMassivaClosed(ticket)) return false
  return (
    ticket.ellevenLifecycle === 'open' ||
    ticket.ellevenLifecycle === 'unknown' ||
    effectiveMassivaStatus(ticket) === 'aberta'
  )
}

/**
 * Protocolos fora do catálogo com MySQL ainda `aberta` mas Elleven já encerrou —
 * para `mark-closed-by-protocols` (somente monitorização OOT).
 */
export function collectOutOfCatalogProtocolsForLocalCloseSync(
  bffTickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[],
): number[] {
  const localAbertaProtocols = new Set<number>()
  for (const row of localRows) {
    if (row.status !== 'aberta' || row.closedAt != null) continue
    const protocol = row.protocol
    if (protocol != null && protocol > 0) {
      localAbertaProtocols.add(protocol)
    }
  }

  const protocols: number[] = []
  for (const bff of bffTickets) {
    if (bff.protocol <= 0) continue
    if (!isMassivaMonitoringOutOfCatalogTitle(bff.title)) continue
    if (!bffSaysMassivaClosed(bff)) continue
    if (!localAbertaProtocols.has(bff.protocol)) continue
    protocols.push(bff.protocol)
  }

  return protocols
}
