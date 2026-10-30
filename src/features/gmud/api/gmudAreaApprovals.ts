import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type AreaApprovalStatus = 'pendente' | 'aprovada' | 'negada'
export type GmudAreasStatus = 'nao_aplicavel' | AreaApprovalStatus

/** Situação de uma área no detalhe da GMUD (sem códigos de aprovação). */
export type GmudAreaApproval = {
  id: number
  areaId: number
  areaLabel: string
  status: AreaApprovalStatus
  decidedByEmail: string | null
  decidedByName: string | null
  decidedAt: string | null
  motivo: string | null
  pessoas: Array<{ email: string; nome: string }>
}

export type AreaApprovalState = 'pending' | 'decided' | 'expired' | 'closed'

export type AreaApprovalInfo = {
  state: AreaApprovalState
  area: string
  approver: string
  decision: AreaApprovalStatus | null
  decidedByName: string | null
  decidedAt: string | null
  gmud: {
    protocolo: number
    titulo: string
    tipo: string
    categoria: string
    descricao: string
    popSite: string
    /** Abrangência na rede já formatada (ponto de acesso · slot · PON · splitter); vazio = site inteiro. */
    escopoRede?: string
    solicitante: string
    dataInicio: string
    horaInicio: string
    dataFim: string
    horaFim: string
  }
}

export type AreaApprovalOutcome = {
  decision: 'aprovada' | 'negada'
  area: string
  areasStatus: GmudAreasStatus
  canceladoNoElleven: boolean | null
  gmudAprovada?: boolean
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    const message = (result && typeof result.message === 'string' && result.message) || fallback
    const error = new Error(message) as Error & { statusCode?: number }
    error.statusCode = response.status
    throw error
  }
  return result.data as T
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** O código vai no fragmento (#t=...): o navegador não o envia ao servidor nem aparece em logs de acesso. */
export function readApprovalTokenFromHash(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('t')?.trim() ?? ''
}

/**
 * Endpoints PÚBLICOS: a pessoa chega pelo link do e-mail, sem login. Por isso não usam a sessão.
 * O código vai no corpo (POST), nunca na URL.
 */
export async function fetchAreaApprovalInfo(token: string): Promise<AreaApprovalInfo> {
  const response = await fetch(`${env.localBffUrl}/api/gmud/area-approval/info`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token }),
  })
  return parse<AreaApprovalInfo>(response, 'Não foi possível abrir este pedido de aprovação.')
}

export async function submitAreaApproval(input: {
  token: string
  decision: 'aprovada' | 'negada'
  motivo?: string
}): Promise<AreaApprovalOutcome> {
  const response = await fetch(`${env.localBffUrl}/api/gmud/area-approval/decide`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return parse<AreaApprovalOutcome>(response, 'Não foi possível registrar a decisão.')
}

export type ApprovalAreasCheck = {
  areas: Array<{ label: string; pessoas: number }>
  semResponsavel: string[]
}

/** Antes de abrir o protocolo: confere se toda área da GMUD tem quem aprove. */
export async function checkApprovalAreas(input: {
  tipo: string
  categoria: string
  categoriaData: unknown
  recursosAdministrativos: Record<string, string>
}): Promise<ApprovalAreasCheck> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/approval-areas/check`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  })
  return parse<ApprovalAreasCheck>(response, 'Falha ao conferir os responsáveis pelas áreas.')
}

/** O Comitê aprova em nome de uma área que não respondeu. */
export async function overrideAreaApproval(protocol: number, areaId: number): Promise<void> {
  const response = await fetchWithSessionAuth(
    `${env.localBffUrl}/api/gmud/${protocol}/area-approvals/${areaId}/override`,
    { method: 'POST' },
  )
  await parse<unknown>(response, 'Falha ao aprovar em nome da área.')
}
