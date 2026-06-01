import {
  ellevenStatusTextIndicatesClosed,
  ellevenStatusTextIndicatesOpen,
  normalizeEllevenStatusText,
} from '@/features/massiva/lib/massivaEllevenStatusText'
import { resolveMassivaStatusFromIncidentStatusId } from '@/features/massiva/model/massivaTicket'

export type EllevenMassivaLifecycle = 'open' | 'closed' | 'unknown'

/**
 * Infere se o Elleven considera o protocolo aberto ou encerrado/cancelado a partir de vários campos
 * (a listagem costuma trazer textos conflitantes — ex.: situation vs incidentStatus.title).
 */
export function inferEllevenMassivaLifecycle(input: {
  statusTexts: readonly string[]
  incidentStatusId: number | null
  closedAt: Date | null
  cancelledAt?: Date | null
  expectedCloseAt: Date | null
  nowMs?: number
}): EllevenMassivaLifecycle {
  const now = input.nowMs ?? Date.now()

  if (input.closedAt != null || input.cancelledAt != null) return 'closed'

  const fromIncidentId = resolveMassivaStatusFromIncidentStatusId(
    input.incidentStatusId,
    input.statusTexts,
  )
  if (fromIncidentId === 'encerrada') return 'closed'
  if (fromIncidentId === 'aberta') {
    const anyClosedText = input.statusTexts.some(ellevenStatusTextIndicatesClosed)
    if (!anyClosedText) return 'open'
  }

  if (input.statusTexts.some(ellevenStatusTextIndicatesClosed)) return 'closed'

  if (input.statusTexts.some(ellevenStatusTextIndicatesOpen)) return 'open'

  if (
    input.expectedCloseAt != null &&
    input.expectedCloseAt.getTime() < now - 2 * 60 * 60 * 1000
  ) {
    return 'closed'
  }

  return 'unknown'
}

export function collectEllevenStatusTexts(parts: {
  merged: Record<string, unknown>
  incidentStatus: Record<string, unknown>
  assignment: Record<string, unknown>
  atendimento: Record<string, unknown>
  chamado: Record<string, unknown>
}): string[] {
  const out: string[] = []
  const add = (value: unknown) => {
    const text = normalizeEllevenStatusText(value)
    if (text !== '' && !out.includes(text)) out.push(text)
  }

  const { merged, incidentStatus, assignment, atendimento, chamado } = parts
  for (const value of [
    merged.status,
    merged.situation,
    merged.situacao,
    merged.estado,
    merged.state,
    merged.situationDescription,
    merged.situacaoDescricao,
    merged.descricaoSituacao,
    merged.statusDescription,
    merged.statusName,
    merged.incidentSituation,
    merged.incidentSituationDescription,
    merged.solicitationSituation,
    merged.solicitationSituationDescription,
    incidentStatus.title,
    incidentStatus.name,
    incidentStatus.label,
    incidentStatus.description,
    incidentStatus.situation,
    incidentStatus.situacao,
    assignment.status,
    assignment.situation,
    assignment.situacao,
    atendimento.status,
    atendimento.situation,
    atendimento.situacao,
    chamado.status,
    chamado.situation,
    chamado.situacao,
    merged.catalogo,
  ]) {
    add(value)
  }

  return out
}
