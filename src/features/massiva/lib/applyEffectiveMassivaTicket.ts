import {
  ellevenStatusTextsIndicateCancelled,
  ellevenStatusTextsIndicateClosed,
} from '@/features/massiva/lib/massivaEllevenStatusText'
import type { MassivaStatus, MassivaTicket } from '@/features/massiva/model/massivaTicket'

/**
 * Status efetivo para filtros/UI: encerramento/cancelamento no Elleven prevalece sobre texto ambíguo.
 * Cancelamento tem PRECEDÊNCIA sobre encerramento (é um subtipo distinto de "não aberto").
 */
export function effectiveMassivaStatus(ticket: MassivaTicket): MassivaStatus {
  // Cancelado vence: seja pelo status local persistido, seja pelos textos de situação do Elleven.
  if (ticket.status === 'cancelada') return 'cancelada'
  if (ellevenStatusTextsIndicateCancelled(ticket.ellevenStatusTexts ?? [])) return 'cancelada'
  if (ticket.ellevenLifecycle === 'closed') return 'encerrada'
  if (ellevenStatusTextsIndicateClosed(ticket.ellevenStatusTexts ?? [])) return 'encerrada'
  if (ticket.closedAt != null) return 'encerrada'
  if (ticket.status === 'encerrada') return 'encerrada'
  if (ticket.status === 'aberta') return 'aberta'
  return ticket.status
}

export function applyEffectiveMassivaTicket(ticket: MassivaTicket): MassivaTicket {
  const status = effectiveMassivaStatus(ticket)
  if (status === ticket.status) return ticket
  return { ...ticket, status }
}
