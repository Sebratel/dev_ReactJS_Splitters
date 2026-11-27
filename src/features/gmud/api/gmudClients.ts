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

/** Estimativa ao vivo (formulário em preenchimento): a GMUD ainda não existe, só o escopo. */
export type GmudClientImpactEstimate = {
  applicable: boolean
  /** false enquanto falta o POP/Site ou a busca não conseguiu calcular. */
  pronto: boolean
  total?: number
  corporativos?: number
  /** Máximo de clientes por GMUD no envio aos afetados; acima disso a GMUD não é incluída. */
  limite?: number
  erro?: string
}

export async function estimateGmudClientImpact(
  input: { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] },
  signal?: AbortSignal,
): Promise<GmudClientImpactEstimate> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/clientes-impactados/estimativa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  return parse<GmudClientImpactEstimate>(response, 'Falha ao estimar os clientes impactados.')
}

export async function fetchGmudActiveClients(): Promise<GmudActiveClient[]> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud-clientes/ativos`)
  const data = await parse<{ items: GmudActiveClient[] }>(response, 'Falha ao carregar os clientes de GMUD.')
  return Array.isArray(data.items) ? data.items : []
}

/** Cliente da lista do popup "Clientes impactados" (sem PPPoE, só o que ajuda a conferir). */
export type GmudImpactedClient = {
  contractId: number
  nome: string
  corporativo: boolean
  pontoAcesso: string
}

export type GmudImpactedClientsList = {
  pronto: boolean
  total: number
  /** true quando a lista foi cortada no teto de segurança do servidor. */
  truncado: boolean
  clientes: GmudImpactedClient[]
  erro?: string
}

export async function fetchGmudImpactedClients(
  input: { popSite: string; escopoRotas: unknown[]; clientesSemSplitter: unknown[] },
  signal?: AbortSignal,
): Promise<GmudImpactedClientsList> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/gmud/clientes-impactados/lista`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  return parse<GmudImpactedClientsList>(response, 'Falha ao listar os clientes impactados.')
}
