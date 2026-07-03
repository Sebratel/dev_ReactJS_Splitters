import type { MassivaOpenMutationSuccessPayload } from '@/features/massiva/model/massivaOpenMutation'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import {
  countMapeableAfetadosForAccessPoint,
  resolveMassivaSplitterCodeForAccessPoint,
  resolveMassivaTitleForAccessPoint,
} from '@/features/massiva/lib/massivaOpenTicketSnapshot'
import type { MassivaTicket } from '@/features/massiva/model/massivaTicket'

function protocolsForOpenResult(result: MassivaOpenMutationSuccessPayload['results'][number]): number[] {
  const set = new Set<number>()
  if (result.protocol != null && result.protocol > 0) set.add(result.protocol)
  for (const p of result.createdProtocols) {
    if (p > 0) set.add(p)
  }
  return [...set]
}

export function massivaTicketsFromOpenSuccess(
  payload: MassivaOpenMutationSuccessPayload,
  context?: MassivaOpenFinalContext,
  options?: { openedAt?: Date },
): MassivaTicket[] {
  const openedAt = options?.openedAt ?? new Date()
  const closedAt = payload.autoClosedWithoutClients === true ? openedAt : null
  const status = closedAt != null ? 'encerrada' : 'aberta'

  const out: MassivaTicket[] = []
  const seen = new Set<number>()

  for (const result of payload.results) {
    const protocols = protocolsForOpenResult(result)
    if (protocols.length === 0) continue

    const title =
      context != null
        ? resolveMassivaTitleForAccessPoint(context, result.accessPointCode)
        : ''
    const splitterCode =
      context != null
        ? resolveMassivaSplitterCodeForAccessPoint(context, result.accessPointCode)
        : ''
    const affectedClients =
      context != null
        ? countMapeableAfetadosForAccessPoint(context, result.accessPointCode)
        : 0
    const resolvedTitle =
      title.trim() !== '' ? title.trim() : `Massiva AP ${result.accessPointCode}`

    for (const protocol of protocols) {
      if (seen.has(protocol)) continue
      seen.add(protocol)

      out.push({
        protocol,
        assignmentId: result.assignmentId,
        title: resolvedTitle,
        description: result.message,
        apCode: result.accessPointCode,
        splitterCode,
        team: '',
        createdBy: context?.operatorEmail ?? '',
        responsible: '',
        status,
        ellevenLifecycle: closedAt != null ? 'closed' : 'open',
        ellevenIncidentStatusId: null,
        ellevenStatusTexts: closedAt != null ? ['encerrada'] : ['aberta'],
        openedAt,
        expectedCloseAt: null,
        previsaoEncerramentoAtualizadaPor: '',
        estimateTimeOfRestoration: null,
        closedAt,
        closeDescription: null,
        closedBy: null,
        affectedClients,
        affectedClientsResidential: null,
        affectedClientsCorporate: null,
        usedFallback: false,
      })
    }
  }

  return out
}
