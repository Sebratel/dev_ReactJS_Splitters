import type { MassivaHistoryListRow } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'
import {
  applyEffectiveMassivaTicket,
  effectiveMassivaStatus,
} from '@/features/massiva/lib/applyEffectiveMassivaTicket'
import { isMassivaMonitoringOutOfCatalogTitle } from '@/features/massiva/lib/massivaCatalogTitle'
import { resolveAffectedClientsForMergedTicket } from '@/features/massiva/lib/massivaTicketAffectedClients'
import {
  bffSaysMassivaClosed,
  bffSaysMassivaOpen,
} from '@/features/massiva/lib/syncOutOfCatalogMassivaFromBff'
import { restorationHoursBetweenDates } from '@/features/massiva/lib/formatMassivaListDate'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

export const LOCAL_OPEN_TRUST_MS = 7 * 24 * 60 * 60 * 1000

export function ticketOpenedInPeriod(
  openedAt: Date | null,
  periodStart: Date,
): boolean {
  if (openedAt == null) return false
  return openedAt.getTime() >= periodStart.getTime()
}

function withAffectedClients(
  ticket: MassivaTicket,
  localRow: MassivaHistoryListRow | null,
  local: MassivaTicket | null,
  bff: MassivaTicket | null,
): MassivaTicket {
  const merged = applyEffectiveMassivaTicket(ticket)
  return {
    ...merged,
    affectedClients: resolveAffectedClientsForMergedTicket({
      localRow,
      local,
      bff,
      merged,
    }),
  }
}

function massivaTicketFromLocalHistoryRow(row: MassivaHistoryListRow): MassivaTicket {
  const closed = row.status === 'encerrada' || row.closedAt != null
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
    ellevenLifecycle: closed ? 'closed' : 'unknown',
    ellevenIncidentStatusId: null,
    ellevenStatusTexts: [],
    openedAt: row.openedAt,
    expectedCloseAt: row.expectedCloseAt,
    previsaoEncerramentoAtualizadaPor: '',
    estimateTimeOfRestoration: null,
    closedAt: row.closedAt,
    closeDescription: row.closeDescription ?? null,
    closedBy: row.closedBy ?? null,
    affectedClients: row.affectedClients,
    affectedClientsResidential: null,
    affectedClientsCorporate: null,
    usedFallback: false,
  })
}

/** Encerrada no painel: base MySQL; Elleven só enriquece metadados. */
function applyClosedMassivaFromLocalRow(
  row: MassivaHistoryListRow,
  bff?: MassivaTicket,
): MassivaTicket {
  const base = applyEffectiveMassivaTicket({
    ...massivaTicketFromLocalHistoryRow(row),
    status: 'encerrada',
    ellevenLifecycle: 'closed',
    closedAt: row.closedAt ?? bff?.closedAt ?? null,
  })
  if (!bff) return base

  const bffEffective = applyEffectiveMassivaTicket(bff)
  return withAffectedClients(
    {
      ...base,
      title: bffEffective.title.trim() !== '' ? bffEffective.title : base.title,
      description:
        bffEffective.description.trim() !== '' ? bffEffective.description : base.description,
      apCode: bffEffective.apCode.trim() !== '' ? bffEffective.apCode : base.apCode,
      splitterCode:
        bffEffective.splitterCode.trim() !== '' ? bffEffective.splitterCode : base.splitterCode,
      team: bffEffective.team.trim() !== '' ? bffEffective.team : base.team,
      responsible: bffEffective.responsible.trim() !== '' ? bffEffective.responsible : base.responsible,
      assignmentId: bffEffective.assignmentId ?? base.assignmentId,
      ellevenIncidentStatusId: bffEffective.ellevenIncidentStatusId,
      ellevenStatusTexts: bffEffective.ellevenStatusTexts,
      openedAt: base.openedAt ?? bffEffective.openedAt,
      closedAt: base.closedAt ?? bffEffective.closedAt,
      expectedCloseAt: bffEffective.expectedCloseAt ?? base.expectedCloseAt,
      status: 'encerrada',
      ellevenLifecycle: 'closed',
      affectedClientsResidential: bffEffective.affectedClientsResidential,
      affectedClientsCorporate: bffEffective.affectedClientsCorporate,
      estimateTimeOfRestoration:
        bffEffective.estimateTimeOfRestoration ?? base.estimateTimeOfRestoration,
      previsaoEncerramentoAtualizadaPor:
        bffEffective.previsaoEncerramentoAtualizadaPor || base.previsaoEncerramentoAtualizadaPor,
      usedFallback: bffEffective.usedFallback || base.usedFallback,
    },
    row,
    base,
    bff,
  )
}

function isRecentLocalOpen(row: MassivaHistoryListRow, nowMs: number): boolean {
  if (row.status !== 'aberta' || row.closedAt != null) return false
  const opened = row.openedAt
  if (opened == null) return false
  return nowMs - opened.getTime() <= LOCAL_OPEN_TRUST_MS
}

function bffIndicatesClosed(bff: MassivaTicket): boolean {
  return bff.ellevenLifecycle === 'closed' || effectiveMassivaStatus(bff) === 'encerrada'
}

function shouldTrustLocalOpenOverBff(
  local: MassivaHistoryListRow,
  bff: MassivaTicket,
  nowMs: number,
): boolean {
  if (
    isMassivaMonitoringOutOfCatalogTitle(local.title) ||
    isMassivaMonitoringOutOfCatalogTitle(bff.title)
  ) {
    return false
  }
  if (!isRecentLocalOpen(local, nowMs)) return false
  if (bff.ellevenLifecycle === 'closed') return false
  return (
    effectiveMassivaStatus(bff) === 'desconhecida' ||
    (effectiveMassivaStatus(bff) === 'encerrada' && bff.ellevenLifecycle !== 'open')
  )
}

function mergeBffOntoLocal(
  local: MassivaTicket,
  bff: MassivaTicket,
  localRow: MassivaHistoryListRow,
  nowMs: number,
): MassivaTicket {
  const trustLocalOpen = shouldTrustLocalOpenOverBff(localRow, bff, nowMs)
  const bffEffective = applyEffectiveMassivaTicket(bff)

  if ((bffEffective.status === 'encerrada' || bff.ellevenLifecycle === 'closed') && !trustLocalOpen) {
    return withAffectedClients(
      {
        ...local,
        ...bffEffective,
        status: 'encerrada',
        ellevenLifecycle: 'closed',
        ellevenIncidentStatusId: bffEffective.ellevenIncidentStatusId,
        closedAt: bffEffective.closedAt ?? local.closedAt,
        openedAt: local.openedAt ?? bffEffective.openedAt,
        closeDescription: local.closeDescription ?? bffEffective.closeDescription,
        closedBy: local.closedBy ?? bffEffective.closedBy,
      },
      localRow,
      local,
      bff,
    )
  }

  const openedAt = local.openedAt ?? bffEffective.openedAt
  const expectedCloseAt = local.expectedCloseAt ?? bffEffective.expectedCloseAt
  const hoursFromMysql =
    local.expectedCloseAt != null
      ? restorationHoursBetweenDates(openedAt, expectedCloseAt)
      : null

  return withAffectedClients(
    {
      ...local,
      title: bffEffective.title.trim() !== '' ? bffEffective.title : local.title,
      description: bffEffective.description.trim() !== '' ? bffEffective.description : local.description,
      apCode: bffEffective.apCode.trim() !== '' ? bffEffective.apCode : local.apCode,
      splitterCode: bffEffective.splitterCode.trim() !== '' ? bffEffective.splitterCode : local.splitterCode,
      team: bffEffective.team.trim() !== '' ? bffEffective.team : local.team,
      responsible: bffEffective.responsible.trim() !== '' ? bffEffective.responsible : local.responsible,
      assignmentId: bffEffective.assignmentId ?? local.assignmentId,
      openedAt,
      expectedCloseAt,
      closedAt: trustLocalOpen ? null : bffEffective.closedAt ?? local.closedAt,
      status: trustLocalOpen ? 'aberta' : bffEffective.status === 'aberta' ? 'aberta' : local.status,
      ellevenLifecycle: trustLocalOpen ? 'open' : bffEffective.ellevenLifecycle,
      ellevenIncidentStatusId: bffEffective.ellevenIncidentStatusId,
      ellevenStatusTexts: bffEffective.ellevenStatusTexts,
      affectedClientsResidential: bffEffective.affectedClientsResidential ?? local.affectedClientsResidential,
      affectedClientsCorporate: bffEffective.affectedClientsCorporate ?? local.affectedClientsCorporate,
      estimateTimeOfRestoration:
        hoursFromMysql ??
        bffEffective.estimateTimeOfRestoration ??
        local.estimateTimeOfRestoration,
      previsaoEncerramentoAtualizadaPor:
        bffEffective.previsaoEncerramentoAtualizadaPor || local.previsaoEncerramentoAtualizadaPor,
      usedFallback: bffEffective.usedFallback || local.usedFallback,
    },
    localRow,
    local,
    bff,
  )
}

function indexBffTickets(bffTickets: readonly MassivaTicket[]): Map<number, MassivaTicket> {
  const map = new Map<number, MassivaTicket>()
  for (const ticket of bffTickets) {
    if (ticket.protocol > 0) {
      map.set(ticket.protocol, applyEffectiveMassivaTicket(ticket))
    }
  }
  return map
}

/**
 * Abertas: Elleven (BFF + afetados). Encerradas: `massiva_history` (MySQL) com afetados locais.
 */
export function buildDashboardMassivaTickets(input: {
  bffTickets: readonly MassivaTicket[]
  localRows: readonly MassivaHistoryListRow[]
  recentOpenTickets: readonly MassivaTicket[]
  periodStart: Date
}): MassivaTicket[] {
  const nowMs = Date.now()
  const byProtocol = new Map<number, MassivaTicket>()
  const bffByProtocol = indexBffTickets(input.bffTickets)
  const localRowByProtocol = new Map<number, MassivaHistoryListRow>()
  for (const row of input.localRows) {
    const protocol = row.protocol
    if (protocol != null && protocol > 0) {
      localRowByProtocol.set(protocol, row)
    }
  }

  for (const row of input.localRows) {
    const protocol = row.protocol
    if (protocol == null || protocol <= 0) continue

    const bff = bffByProtocol.get(protocol)

    if (row.status === 'encerrada' || row.closedAt != null) {
      byProtocol.set(protocol, applyClosedMassivaFromLocalRow(row, bff))
      continue
    }

    if (row.status === 'aberta') {
      if (isRecentLocalOpen(row, nowMs)) {
        const localTicket = massivaTicketFromLocalHistoryRow(row)
        byProtocol.set(
          protocol,
          bff
            ? mergeBffOntoLocal(localTicket, bff, row, nowMs)
            : withAffectedClients(localTicket, row, localTicket, null),
        )
        continue
      }

      if (bff) {
        if (bffIndicatesClosed(bff)) {
          byProtocol.set(
            protocol,
            applyClosedMassivaFromLocalRow(row, bff),
          )
          continue
        }
        if (bff.ellevenLifecycle === 'open' || effectiveMassivaStatus(bff) === 'aberta') {
          byProtocol.set(
            protocol,
            mergeBffOntoLocal(massivaTicketFromLocalHistoryRow(row), bff, row, nowMs),
          )
          continue
        }
        continue
      }

      continue
    }

    byProtocol.set(
      protocol,
      withAffectedClients(massivaTicketFromLocalHistoryRow(row), row, massivaTicketFromLocalHistoryRow(row), bff ?? null),
    )
  }

  for (const bff of input.bffTickets) {
    if (bff.protocol <= 0) continue
    if (byProtocol.has(bff.protocol)) continue

    const bffEffective = applyEffectiveMassivaTicket(bff)
    if (!ticketOpenedInPeriod(bffEffective.openedAt, input.periodStart)) continue

    if (isMassivaMonitoringOutOfCatalogTitle(bffEffective.title)) {
      if (bffSaysMassivaClosed(bffEffective) || bffSaysMassivaOpen(bffEffective)) {
        byProtocol.set(
          bff.protocol,
          withAffectedClients(bffEffective, null, null, bff),
        )
      }
      continue
    }

    if (bff.ellevenLifecycle === 'closed' || bffEffective.status === 'encerrada') {
      continue
    }

    if (bffEffective.status !== 'aberta' && bff.ellevenLifecycle !== 'open') continue

    byProtocol.set(
      bff.protocol,
      withAffectedClients(bffEffective, null, null, bff),
    )
  }

  for (const recent of input.recentOpenTickets) {
    if (recent.protocol <= 0) continue
    const bff = bffByProtocol.get(recent.protocol)
    const existing = byProtocol.get(recent.protocol)
    const localRow = localRowByProtocol.get(recent.protocol)

    if (bff && bffIndicatesClosed(bff)) {
      const bffEffective = applyEffectiveMassivaTicket(bff)
      if (localRow) {
        byProtocol.set(recent.protocol, applyClosedMassivaFromLocalRow(localRow, bff))
      } else if (isMassivaMonitoringOutOfCatalogTitle(bffEffective.title)) {
        byProtocol.set(
          recent.protocol,
          withAffectedClients(bffEffective, null, null, bff),
        )
      }
      continue
    }

    if (existing && localRow) {
      byProtocol.set(
        recent.protocol,
        mergeBffOntoLocal(
          massivaTicketFromLocalHistoryRow(localRow),
          bff ?? recent,
          localRow,
          nowMs,
        ),
      )
      continue
    }

    if (existing) {
      if (bffIndicatesClosed(existing)) {
        continue
      }
      byProtocol.set(
        recent.protocol,
        withAffectedClients(
          applyEffectiveMassivaTicket({
            ...existing,
            ...recent,
            openedAt: existing.openedAt ?? recent.openedAt,
            ellevenLifecycle:
              existing.ellevenLifecycle === 'closed' ? 'closed' : recent.ellevenLifecycle,
            status:
              effectiveMassivaStatus(existing) === 'encerrada' ? 'encerrada' : 'aberta',
          }),
          localRow ?? null,
          existing,
          bff ?? null,
        ),
      )
      continue
    }

    if (bff) {
      byProtocol.set(recent.protocol, withAffectedClients(bff, localRow ?? null, null, bff))
      continue
    }

    const openedAt = recent.openedAt ?? new Date()
    byProtocol.set(
      recent.protocol,
      withAffectedClients(
        applyEffectiveMassivaTicket({
          ...recent,
          openedAt,
          status: 'aberta',
          ellevenLifecycle: 'open',
        }),
        localRow ?? null,
        null,
        null,
      ),
    )
  }

  return [...byProtocol.values()].sort((a, b) => {
    const ta = a.openedAt?.getTime() ?? 0
    const tb = b.openedAt?.getTime() ?? 0
    return tb - ta
  })
}
