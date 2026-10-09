import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type { GmudPendingItem } from '@/features/gmud/api/gmudApprovals'

export type GmudDetailVoalle = {
  protocol: number
  assignmentId: number | null
  title: string
  description: string
  openedAt: string | null
  slaDate: string | null
  conclusionDate: string | null
  statusId: number | null
  status: string
  requester: string
  requesterEmail: string
}

export type GmudDetailRequest = GmudPendingItem & {
  aprovadoPor: string | null
  decididoEm: string | null
}

export type GmudEvent = {
  type: string
  actor: string | null
  payload: Record<string, unknown> | null
  at: string | null
}

export type GmudDetailLink = {
  gmudProtocol: number
  massivaProtocol: number
  affectedClients: number | null
  title: string | null
  status: string | null
  createdAt: string | null
}

export type GmudDetail = {
  voalle: GmudDetailVoalle
  request: GmudDetailRequest | null
  events: GmudEvent[]
  links: GmudDetailLink[]
}

export async function fetchGmudDetail(protocol: number): Promise<GmudDetail> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${protocol}/detail`)
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || 'Falha ao carregar a GMUD.')
  }
  return result.data as GmudDetail
}
