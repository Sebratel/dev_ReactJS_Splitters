import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import { env } from '@/shared/config/env'

export type MassivaHistoryListRow = {
  id: number
  protocol: number | null
  assignmentId: number | null
  accessPointCode: string
  title: string
  operatorEmail: string
  affectedClients: number
  status: 'aberta' | 'encerrada'
  openedAt: Date | null
  expectedCloseAt: Date | null
  closedAt: Date | null
  /** Relato preenchido pelo operador ao encerrar a massiva. */
  closeDescription: string | null
  /** Autor do encerramento (usuário da plataforma). */
  closedBy: string | null
  updatedAt: Date | null
}

function toNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (text === '') return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date
}

function toInt(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

export async function fetchMassivaHistoryListFromLocalDb(input: {
  status?: 'aberta' | 'encerrada' | null
  startDate?: Date | null
  endDate?: Date | null
  limit?: number
}): Promise<MassivaHistoryListRow[]> {
  const params = new URLSearchParams()
  if (input.status) params.set('status', input.status)
  if (input.startDate) params.set('startDate', input.startDate.toISOString())
  if (input.endDate) params.set('endDate', input.endDate.toISOString())
  params.set('limit', String(input.limit ?? 3000))

  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/massiva/history/list?${params.toString()}`,
  )
  if (!response.ok) {
    throw new Error(`Erro ao consultar histórico local de massivas: ${response.status}`)
  }

  const parsed = await response.json()
  if (!parsed?.success || !Array.isArray(parsed.data)) {
    throw new Error('Formato de resposta inesperado ao consultar histórico local de massivas.')
  }

  return parsed.data.map((row: Record<string, unknown>) => ({
    id: toInt(row.id),
    protocol: row.protocol == null ? null : toInt(row.protocol),
    assignmentId: row.assignmentId == null ? null : toInt(row.assignmentId),
    accessPointCode: String(row.accessPointCode ?? '').trim(),
    title: String(row.title ?? '').trim(),
    operatorEmail: String(row.operatorEmail ?? '').trim(),
    affectedClients: Math.max(0, toInt(row.affectedClients)),
    status: String(row.status ?? '').trim().toLowerCase() === 'encerrada' ? 'encerrada' : 'aberta',
    openedAt: toNullableDate(row.openedAt),
    expectedCloseAt: toNullableDate(row.expectedCloseAt),
    closedAt: toNullableDate(row.closedAt),
    closeDescription: row.closeDescription != null && String(row.closeDescription).trim() !== ''
      ? String(row.closeDescription).trim()
      : null,
    closedBy: row.closedBy != null && String(row.closedBy).trim() !== ''
      ? String(row.closedBy).trim()
      : null,
    updatedAt: toNullableDate(row.updatedAt),
  }))
}
