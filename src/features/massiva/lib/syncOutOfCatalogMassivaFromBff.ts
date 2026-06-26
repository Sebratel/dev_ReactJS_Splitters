import {
  effectiveMassivaStatus,
} from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
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

/** Após abertura, o catálogo Elleven pode demorar a listar o protocolo. */
export const LOCAL_CLOSE_MISSING_FROM_BFF_GRACE_MS = 2 * 60 * 60 * 1000

export const LOCAL_CLOSE_EXPIRED_PREVISAO_GRACE_MS = 2 * 60 * 60 * 1000

function localAbertaProtocolsFromRows(
  localRows: readonly MassivaHistoryListRow[],
): Set<number> {
  const localAbertaProtocols = new Set<number>()
  for (const row of localRows) {
    if (row.status !== 'aberta' || row.closedAt != null) continue
    const protocol = row.protocol
    if (protocol != null && protocol > 0) {
      localAbertaProtocols.add(protocol)
    }
  }
  return localAbertaProtocols
}

/** Previsão de encerramento já passou há horas — típico de MySQL `aberta` obsoleto. */
export function localRowExpectedCloseExpired(
  row: MassivaHistoryListRow,
  nowMs = Date.now(),
): boolean {
  const close = row.expectedCloseAt
  if (close == null || Number.isNaN(close.getTime())) return false
  return close.getTime() < nowMs - LOCAL_CLOSE_EXPIRED_PREVISAO_GRACE_MS
}

/**
 * MySQL ainda `aberta` mas Elleven já encerrou ou protocolo sumiu do BFF há horas —
 * para `mark-closed-by-protocols`.
 *
 * Somente sincroniza encerramento quando o Elleven/BFF confirma: ou o BFF diz
 * "encerrada", ou o protocolo desapareceu do catálogo por tempo suficiente.
 * Previsão de encerramento expirada *não* é critério: ela não garante que o
 * Elleven encerrou, e usar ela causaria fechamento local sem acionar o Elleven,
 * deixando o protocolo em aberto lá e os afetados sem limpeza.
 */
export function collectProtocolsForLocalCloseSync(
  bffTickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[],
): number[] {
  const localAbertaProtocols = localAbertaProtocolsFromRows(localRows)
  const protocols = new Set<number>()

  for (const bff of bffTickets) {
    if (bff.protocol <= 0) continue
    if (!bffSaysMassivaClosed(bff)) continue
    if (localAbertaProtocols.has(bff.protocol)) {
      protocols.add(bff.protocol)
    }
  }

  if (bffTickets.length > 0) {
    const bffProtocols = new Set(
      bffTickets.filter((t) => t.protocol > 0).map((t) => t.protocol),
    )
    const now = Date.now()
    for (const row of localRows) {
      if (row.status !== 'aberta' || row.closedAt != null) continue
      const protocol = row.protocol
      if (protocol == null || protocol <= 0) continue
      if (bffProtocols.has(protocol)) continue
      const opened = row.openedAt
      if (opened == null || Number.isNaN(opened.getTime())) continue
      if (now - opened.getTime() > LOCAL_CLOSE_MISSING_FROM_BFF_GRACE_MS) {
        protocols.add(protocol)
      }
    }
  }

  return [...protocols].sort((a, b) => a - b)
}

/** @deprecated Prefer `collectProtocolsForLocalCloseSync` (inclui catálogo + sumiu do BFF). */
export function collectOutOfCatalogProtocolsForLocalCloseSync(
  bffTickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[],
): number[] {
  return collectProtocolsForLocalCloseSync(bffTickets, localRows)
}
