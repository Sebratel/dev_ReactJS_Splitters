import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

/** Impacto de uma GMUD em clientes: do histórico (já incluída) ou estimado pelo escopo. */
export type GmudClientImpact = {
  /** Só GMUD de rede externa tem clientes. */
  applicable: boolean
  source?: 'historico' | 'estimativa'
  status?: 'incluida' | 'removida' | 'nao_incluida'
  total?: number
  /** Gravados em assignment_clients (os que não estavam em outro evento). */
  incluidos?: number
  deForaPorOutroEvento?: number
  corporativos?: number
  includedAt?: string | null
  removedAt?: string | null
  removedReason?: string | null
  windowEnd?: string | null
  /** Motivo de não ter conseguido estimar. */
  erro?: string
}

/** Cliente hoje sinalizado por uma GMUD. */
export type GmudActiveClient = {
  contractId: number
  protocol: number
  corporate: boolean
  includedAt: string | null
  windowEnd: string | null
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json().catch(() => null)
  if (!response.ok || !result?.success) {
    throw new Error((result && typeof result.message === 'string' && result.message) || fallback)
  }
  return result.data as T
}

export async function fetchGmudClientImpact(protocol: number): Promise<GmudClientImpact> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/${protocol}/clientes-impactados`)
  return parse<GmudClientImpact>(response, 'Falha ao carregar os clientes impactados.')
}

export async function fetchGmudActiveClients(): Promise<GmudActiveClient[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud-clientes/ativos`)
  const data = await parse<{ items: GmudActiveClient[] }>(response, 'Falha ao carregar os clientes de GMUD.')
  return Array.isArray(data.items) ? data.items : []
}
