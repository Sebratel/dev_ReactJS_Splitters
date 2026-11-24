import { env } from '@/shared/config/env'
import { fetchWithSessionAuth } from '@/shared/api/fetchWithSessionAuth'
import type {
  MassivaClientConflicts,
  MassivaConflictEvent,
} from '@/features/massiva/model/massivaClientConflicts'

/** Limite por consulta aceito pelo BFF local (`MAX_CONTRACT_IDS`). */
const CHUNK_SIZE = 5000

async function fetchChunk(contractIds: readonly number[], signal?: AbortSignal): Promise<MassivaClientConflicts> {
  const response = await fetchWithSessionAuth(`${env.localBffUrl}/api/massiva/clientes-em-evento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contractIds }),
    signal,
  })
  const parsed = await response.json().catch(() => null)
  if (!response.ok || !parsed?.success || !parsed.data || !Array.isArray(parsed.data.events)) {
    const message =
      (parsed && typeof parsed.message === 'string' && parsed.message) ||
      `Erro ao consultar clientes em outro evento (${response.status}).`
    throw new Error(message)
  }
  return parsed.data as MassivaClientConflicts
}

/** Junta resultados de várias consultas: mesmo evento vira um só, sem repetir cliente. */
export function mergeMassivaClientConflicts(parts: readonly MassivaClientConflicts[]): MassivaClientConflicts {
  const byProtocol = new Map<number, MassivaConflictEvent>()
  const contractIds = new Set<number>()
  for (const part of parts) {
    for (const id of part.contractIds) contractIds.add(id)
    for (const ev of part.events) {
      const current = byProtocol.get(ev.protocol)
      if (!current) {
        byProtocol.set(ev.protocol, { ...ev, clients: [...ev.clients] })
        continue
      }
      const seen = new Set(current.clients.map((c) => c.contractId))
      for (const c of ev.clients) {
        if (!seen.has(c.contractId)) {
          seen.add(c.contractId)
          current.clients.push(c)
        }
      }
    }
  }
  return {
    events: [...byProtocol.values()].sort((a, b) => a.protocol - b.protocol),
    contractIds: [...contractIds],
  }
}

/**
 * Quais destes contratos já fazem parte de OUTRO evento aberto? Só leitura no BFF local; não
 * bloqueia a abertura. Seleções grandes são divididas em consultas de até 5000 contratos.
 */
export async function fetchMassivaClientConflicts(
  contractIds: readonly number[],
  signal?: AbortSignal,
): Promise<MassivaClientConflicts> {
  if (contractIds.length === 0) return { events: [], contractIds: [] }
  const parts: MassivaClientConflicts[] = []
  for (let i = 0; i < contractIds.length; i += CHUNK_SIZE) {
    parts.push(await fetchChunk(contractIds.slice(i, i + CHUNK_SIZE), signal))
  }
  return parts.length === 1 ? parts[0]! : mergeMassivaClientConflicts(parts)
}
