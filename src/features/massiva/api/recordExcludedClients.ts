import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'

export type ExcludedClientInput = {
  contractId: number
  pppoe: string
  corporate: boolean
  /** Evento onde o cliente já estava (nulo quando só o gateway o deixou de fora, sem dizer qual). */
  blockedByProtocol?: number | null
  blockedByType?: 'massiva' | 'gmud' | null
}

/** Extrai `data.skippedContractIds` da resposta do POST de afetados (ausente = nenhum). */
export function parseSkippedContractIds(response: unknown): number[] {
  const data = (response as { data?: { skippedContractIds?: unknown } } | null)?.data
  const raw = data?.skippedContractIds
  if (!Array.isArray(raw)) return []
  return raw.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
}

/**
 * Registra, no histórico do novo evento, os clientes que ficaram de fora por já estarem em outro
 * ("já estava em outro evento"). Também alimenta a fila de reinclusão: se o outro evento fechar e este
 * continuar aberto, o cliente volta a ser sinalizado. Melhor esforço: nunca lança (a abertura já aconteceu).
 */
export async function recordExcludedClients(input: {
  protocol: number
  assignmentId: number
  reason: string
  /** 'yyyy-MM-ddTHH:mm:ss' (horário de Brasília). */
  finishDate: string
  clients: readonly ExcludedClientInput[]
}): Promise<void> {
  if (input.clients.length === 0) return
  try {
    const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/clientes-excluidos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) console.warn('[Massiva] Não foi possível registrar os clientes que ficaram de fora.', response.status)
  } catch (error) {
    console.warn('[Massiva] Não foi possível registrar os clientes que ficaram de fora.', error)
  }
}
