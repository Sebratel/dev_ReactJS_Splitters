import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type CountItem = { key: string; count: number }

export type GmudVoalleIndicators = {
  snapshot: {
    total: number
    openNow: number
    overdueNow: number
    aging: { bucket: string; count: number }[]
    oldestOpen: {
      protocol: number
      title: string
      requester: string
      openedAt: string
      ageDays: number
      overdueDays: number
    }[]
    statusNow: { status: string; count: number }[]
  }
  period: {
    opened: number
    closed: number
    cancelled: number
    closedOnTime: number
    onTimeRate: number | null
    medianHoursToClose: number | null
    monthly: { month: string; opened: number; closed: number; backlog: number }[]
    /** [diaDaSemana 0=dom][hora 0–23] */
    heatmap: number[][]
    requesters: {
      requester: string
      opened: number
      closed: number
      openNow: number
      overdueNow: number
      closedRate: number | null
    }[]
  }
}

export type GmudPlatformIndicators = {
  total: number
  comite: { pendente: number; aprovada: number; negada: number }
  approvalRate: number | null
  medianHoursToDecision: number | null
  exec: { pendente: number; em_execucao: number; concluida: number }
  tipos: CountItem[]
  assuntos: CountItem[]
  ambientes: CountItem[]
  pops: CountItem[]
  impactoParada: CountItem[]
  comunicaCliente: CountItem[]
  rnc: number
  encerradas: { concluida: number; negada: number }
  reagendamentos: { total: number; gmuds: number }
  pastWindowNotClosed: { voalleProtocol: number; title: string; dataFim: string }[]
  windowHeatmap: number[][]
  impacto: {
    gmudsComMassiva: number
    massivasVinculadas: number
    clientesAfetados: number
    topImpact: { gmudProtocol: number; title: string; massivas: number; affectedClients: number }[]
  }
}

export type GmudIndicators = {
  from: string
  to: string
  generatedAt: string
  voalle: GmudVoalleIndicators
  platform: GmudPlatformIndicators | null
  platformError: string | null
}

export async function fetchGmudIndicators(from: string, to: string): Promise<GmudIndicators> {
  const qs = new URLSearchParams({ from, to }).toString()
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/indicators?${qs}`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || 'Falha ao carregar os indicadores.')
  }
  return result.data as GmudIndicators
}
