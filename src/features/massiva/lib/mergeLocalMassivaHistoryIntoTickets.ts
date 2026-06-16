import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import { applyEffectiveMassivaTicket } from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

/** Só inclui abertura só no MySQL local se for recente (evita “fantasmas” abertos no Elleven já encerrados). */
export const LOCAL_ONLY_OPEN_MAX_AGE_MS = 72 * 60 * 60 * 1000

function massivaTicketFromLocalHistoryRow(row: MassivaHistoryListRow): MassivaTicket {
  return applyEffectiveMassivaTicket({
    protocol: row.protocol ?? 0,
    assignmentId: row.assignmentId,
    title: row.title.trim() !== '' ? row.title.trim() : 'Massiva',
    description: '',
    apCode: row.accessPointCode,
    splitterCode: '',
    team: '',
    createdBy: row.operatorEmail,
    responsible: '',
    status: row.status,
    ellevenLifecycle: 'unknown',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: row.openedAt,
    expectedCloseAt: row.expectedCloseAt,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: row.closedAt,
    closeDescription: row.closeDescription ?? null,
    affectedClients: row.affectedClients,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  })
}

function isRecentLocalOpen(row: MassivaHistoryListRow, nowMs: number): boolean {
  if (row.status !== 'aberta' || row.closedAt != null) return false
  const opened = row.openedAt
  if (opened == null) return false
  return nowMs - opened.getTime() <= LOCAL_ONLY_OPEN_MAX_AGE_MS
}

/**
 * BFF = fonte de verdade para status quando o protocolo existe na listagem.
 * Histórico local só enriquece campos e suplementa protocolos muito recentes ainda ausentes no BFF.
 */
export function mergeLocalMassivaHistoryIntoTickets(
  bffTickets: readonly MassivaTicket[],
  localRows: readonly MassivaHistoryListRow[],
  recentOpenTickets: readonly MassivaTicket[] = [],
): MassivaTicket[] {
  const nowMs = Date.now()
  const byProtocol = new Map<number, MassivaTicket>()

  for (const ticket of bffTickets) {
    if (ticket.protocol > 0) {
      byProtocol.set(ticket.protocol, applyEffectiveMassivaTicket(ticket))
    }
  }

  for (const row of localRows) {
    const protocol = row.protocol
    if (protocol == null || protocol <= 0) continue

    const existing = byProtocol.get(protocol)
    if (existing) {
      const localTicket = massivaTicketFromLocalHistoryRow(row)
      byProtocol.set(protocol, applyEffectiveMassivaTicket({
        ...existing,
        openedAt: existing.openedAt ?? localTicket.openedAt,
        expectedCloseAt: existing.expectedCloseAt ?? localTicket.expectedCloseAt,
        closedAt: existing.closedAt ?? localTicket.closedAt,
        status: existing.status,
        affectedClients: Math.max(existing.affectedClients, localTicket.affectedClients),
        assignmentId: existing.assignmentId ?? localTicket.assignmentId,
        apCode: existing.apCode.trim() !== '' ? existing.apCode : localTicket.apCode,
        title: existing.title.trim() !== '' ? existing.title : localTicket.title,
      }))
      continue
    }

    if (isRecentLocalOpen(row, nowMs)) {
      byProtocol.set(protocol, massivaTicketFromLocalHistoryRow(row))
    }
  }

  for (const recent of recentOpenTickets) {
    if (recent.protocol <= 0) continue
    const existing = byProtocol.get(recent.protocol)
    if (existing) {
      byProtocol.set(recent.protocol, applyEffectiveMassivaTicket({
        ...existing,
        openedAt: existing.openedAt ?? recent.openedAt,
        assignmentId: existing.assignmentId ?? recent.assignmentId,
        apCode: existing.apCode.trim() !== '' ? existing.apCode : recent.apCode,
        status:
          existing.status === 'encerrada'
            ? 'encerrada'
            : recent.status === 'aberta'
              ? 'aberta'
              : existing.status,
      }))
    } else {
      byProtocol.set(recent.protocol, applyEffectiveMassivaTicket(recent))
    }
  }

  return [...byProtocol.values()].sort((a, b) => {
    const ta = a.openedAt?.getTime() ?? 0
    const tb = b.openedAt?.getTime() ?? 0
    return tb - ta
  })
}
