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
  status: 'aberta' | 'encerrada' | 'cancelada'
  openedAt: Date | null
  expectedCloseAt: Date | null
  closedAt: Date | null
  /** Relato preenchido pelo operador ao encerrar a massiva. */
  closeDescription: string | null
  /** Autor do encerramento (usuário da plataforma). */
  closedBy: string | null
  /** Início do evento (base para cálculo de MTTD). Null se não informado na abertura. */
  eventStartAt: Date | null
  /**
   * MTTD em minutos: de `eventStartAt` até `eventIdentifiedAt`.
   * Null se `eventStartAt` não foi registrado ou os timestamps são inválidos.
   */
  mttdMinutes: number | null
  /**
   * MTTR em minutos: de `eventIdentifiedAt` até `closedAt`.
   * Null se a massiva ainda está aberta ou os timestamps são inválidos.
   */
  mttrMinutes: number | null
  updatedAt: Date | null
  /** Protocolo de infraestrutura vinculado (1 por evento). Null quando não foi aberto. */
  infraProtocol: number | null
  infraAssignmentId: number | null
  /** Quem identificou o evento (tecnico/zabbix/int6). Null para massivas anteriores à coluna. */
  identifiedBy: 'tecnico' | 'zabbix' | 'int6' | null
  /** Campos de classificação operacional — preenchidos ao encerrar a massiva (podem ser null). */
  tipoIncidente: string | null
  impacto: string | null
  area: string | null
  tecnologia: string | null
  classificacao: string | null
  cnl: string | null
  /**
   * Manutenção pós-encerramento: quem editou a classificação por último (independente
   * de quem encerrou) e quando. Null se a classificação nunca foi editada após o encerramento.
   */
  classificationUpdatedBy: string | null
  classificationUpdatedAt: Date | null
  /**
   * Última verificação (sob demanda) "clientes ainda sem sinal?" — null se nunca foi
   * verificado. Só existe pra massivas cuja lista de afetados foi gravada na abertura
   * (depois desta funcionalidade entrar no ar).
   */
  affectedVerificationCheckedAt: Date | null
  affectedVerificationTotal: number | null
  affectedVerificationStillOffline: number | null
  affectedVerificationStillDegraded: number | null
  affectedVerificationBy: string | null
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
  status?: 'aberta' | 'encerrada' | 'cancelada' | null
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
    status: ((): 'aberta' | 'encerrada' | 'cancelada' => {
      const s = String(row.status ?? '').trim().toLowerCase()
      if (s === 'encerrada') return 'encerrada'
      if (s === 'cancelada') return 'cancelada'
      return 'aberta'
    })(),
    openedAt: toNullableDate(row.openedAt),
    expectedCloseAt: toNullableDate(row.expectedCloseAt),
    closedAt: toNullableDate(row.closedAt),
    closeDescription: row.closeDescription != null && String(row.closeDescription).trim() !== ''
      ? String(row.closeDescription).trim()
      : null,
    closedBy: row.closedBy != null && String(row.closedBy).trim() !== ''
      ? String(row.closedBy).trim()
      : null,
    eventStartAt: toNullableDate(row.eventStartAt),
    mttdMinutes: row.mttdMinutes != null && Number.isFinite(Number(row.mttdMinutes))
      ? Math.round(Number(row.mttdMinutes))
      : null,
    mttrMinutes: row.mttrMinutes != null && Number.isFinite(Number(row.mttrMinutes))
      ? Math.round(Number(row.mttrMinutes))
      : null,
    updatedAt: toNullableDate(row.updatedAt),
    infraProtocol: row.infraProtocol == null ? null : toInt(row.infraProtocol),
    infraAssignmentId: row.infraAssignmentId == null ? null : toInt(row.infraAssignmentId),
    identifiedBy: ((): 'tecnico' | 'zabbix' | 'int6' | null => {
      const v = String(row.identifiedBy ?? '').trim().toLowerCase()
      return v === 'tecnico' || v === 'zabbix' || v === 'int6' ? v : null
    })(),
    tipoIncidente: row.tipoIncidente != null && String(row.tipoIncidente).trim() !== ''
      ? String(row.tipoIncidente).trim()
      : null,
    impacto: row.impacto != null && String(row.impacto).trim() !== ''
      ? String(row.impacto).trim()
      : null,
    area: row.area != null && String(row.area).trim() !== ''
      ? String(row.area).trim()
      : null,
    tecnologia: row.tecnologia != null && String(row.tecnologia).trim() !== ''
      ? String(row.tecnologia).trim()
      : null,
    classificacao: row.classificacao != null && String(row.classificacao).trim() !== ''
      ? String(row.classificacao).trim()
      : null,
    cnl: row.cnl != null && String(row.cnl).trim() !== ''
      ? String(row.cnl).trim()
      : null,
    classificationUpdatedBy: row.classificationUpdatedBy != null && String(row.classificationUpdatedBy).trim() !== ''
      ? String(row.classificationUpdatedBy).trim()
      : null,
    classificationUpdatedAt: toNullableDate(row.classificationUpdatedAt),
    affectedVerificationCheckedAt: toNullableDate(row.affectedVerificationCheckedAt),
    affectedVerificationTotal: row.affectedVerificationTotal == null ? null : toInt(row.affectedVerificationTotal),
    affectedVerificationStillOffline: row.affectedVerificationStillOffline == null ? null : toInt(row.affectedVerificationStillOffline),
    affectedVerificationStillDegraded: row.affectedVerificationStillDegraded == null ? null : toInt(row.affectedVerificationStillDegraded),
    affectedVerificationBy: row.affectedVerificationBy != null && String(row.affectedVerificationBy).trim() !== ''
      ? String(row.affectedVerificationBy).trim()
      : null,
  }))
}
