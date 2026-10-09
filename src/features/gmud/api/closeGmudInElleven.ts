import { bffClient } from '@/shared/api/bffClient'
import { ApiError } from '@/shared/api/apiError'
import { env } from '@/shared/config/env'

/** Motivo do encerramento da GMUD no Elleven. */
export type GmudCloseMode = 'concluida' | 'negada'

function describeGatewayError(error: unknown): string {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.body) as { message?: unknown; messages?: unknown }
      if (typeof parsed.message === 'string' && parsed.message.trim() !== '') {
        return `Elleven recusou o encerramento (HTTP ${error.status}): ${parsed.message.trim()}`
      }
      if (Array.isArray(parsed.messages)) {
        const msgs = (parsed.messages as Array<Record<string, unknown>>)
          .map((m) => String(m.message ?? '').trim())
          .filter((s) => s !== '')
        if (msgs.length > 0) return `Elleven recusou o encerramento (HTTP ${error.status}): ${msgs.join('; ')}`
      }
    } catch {
      if (error.body && error.body.trim() !== '') return `HTTP ${error.status}: ${error.body.slice(0, 400)}`
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function fmtDate(date = new Date()): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${d}/${m}/${y} ${hh}:${mm}`
}

/** Texto do encerramento registrado no Elleven. */
export function buildGmudCloseDescription(mode: GmudCloseMode, user: string): string {
  const quem = user.trim() !== '' ? user.trim() : 'equipe Splitters'
  const quando = fmtDate()
  return mode === 'negada'
    ? `GMUD não aprovada pelo Comitê — encerrada via plataforma por ${quem} em ${quando}.`
    : `GMUD concluída via plataforma por ${quem} em ${quando}.`
}

/**
 * Encerra o protocolo da GMUD no Elleven (endpoint dedicado do gateway — não usa a lógica de
 * protocolos vinculados da massiva). 'concluida' encerra (incidentStatusId de encerrado);
 * 'negada' cancela (incidentStatusId 8). O ciclo é o mesmo da finalização de massiva.
 */
export async function closeGmudInElleven(input: {
  assignmentId: number
  mode: GmudCloseMode
  description: string
}): Promise<void> {
  const incidentStatusId =
    input.mode === 'negada' ? env.massivaCancelIncidentStatusId : env.massivaCloseIncidentStatusId

  try {
    await bffClient.request({
      path: env.gmudClosePath,
      method: 'DELETE',
      body: {
        assignmentId: String(input.assignmentId),
        incidentStatusId,
        description: input.description,
        progress: env.massivaCloseProgress,
        priority: env.massivaClosePriority,
        notificationTarget: env.massivaCloseNotificationTarget,
        privateReport: env.massivaClosePrivateReport,
      },
    })
  } catch (error) {
    throw new Error(describeGatewayError(error))
  }
}
