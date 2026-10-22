import { env } from '@/shared/config/env'
import { bffClient } from '@/shared/api/bffClient'
import { ApiError } from '@/shared/api/apiError'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudWindow } from '@/features/gmud/lib/gmudSchedule'

/** GMUD aprovada com janela, para a agenda. */
export type GmudAgendaItem = GmudWindow & {
  voalleProtocol: number
  assignmentId: number | null
  titulo: string | null
  tipo: string | null
  assunto: string | null
  popSite: string | null
  statusExec: string | null
  ellevenEncerradoEm: string | null
  /** Status atual do protocolo no Elleven — o relato é enviado com ele para não alterá-lo. */
  ellevenStatusId: number | null
  ellevenStatus: string
}

export type GmudRescheduleResult = {
  voalleProtocol: number
  assignmentId: number | null
  previous: GmudWindow
  next: GmudWindow
  ellevenStatusId: number | null
  reagendadoPor: string
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message = (result && typeof result.message === 'string' && result.message) || fallback
    throw new Error(message)
  }
  return result.data as T
}

/** GMUDs aprovadas cuja janela cruza [from, to] (YYYY-MM-DD). */
export async function fetchGmudAgenda(from: string, to: string): Promise<GmudAgendaItem[]> {
  const qs = new URLSearchParams({ from, to }).toString()
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/agenda?${qs}`)
  const data = await parse<{ items: GmudAgendaItem[] }>(response, 'Falha ao carregar a agenda de GMUDs.')
  return data.items
}

/** Grava a nova janela no nosso banco (exige GMUD aprovada e não encerrada). */
export async function rescheduleGmud(input: GmudWindow & { voalleProtocol: number }): Promise<GmudRescheduleResult> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/reschedule`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parse<GmudRescheduleResult>(response, 'Falha ao reagendar a GMUD.')
}

/**
 * Registra um relato no protocolo da GMUD no Elleven sem encerrá-lo: envia o status ATUAL
 * do protocolo (`incidentStatusId`), então o atendimento continua como está.
 */
export async function sendGmudReport(input: {
  assignmentId: number
  incidentStatusId: number
  description: string
}): Promise<void> {
  try {
    await bffClient.request({
      path: env.gmudReportPath,
      method: 'POST',
      body: {
        assignmentId: String(input.assignmentId),
        incidentStatusId: String(input.incidentStatusId),
        description: input.description,
        progress: env.massivaCloseProgress,
        priority: env.massivaClosePriority,
        notificationTarget: env.massivaCloseNotificationTarget,
        privateReport: env.massivaClosePrivateReport,
      },
    })
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(`Elleven recusou o relato (HTTP ${error.status}).`)
    }
    throw error
  }
}
