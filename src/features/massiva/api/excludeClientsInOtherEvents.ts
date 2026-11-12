import { fetchMassivaClientConflicts } from '@/features/massiva/api/fetchMassivaClientConflicts'
import { collectMapeableAfetadosClientes } from '@/features/massiva/lib/buildMassivaAfetadosRequestBody'
import {
  buildConflictContractSet,
  partitionClientesByConflicts,
} from '@/features/massiva/lib/excludeConflictingClients'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'

export type ClientExclusionResult = {
  context: MassivaOpenFinalContext
  /** Clientes (contratos) deixados de fora por já estarem em outro evento aberto. */
  excludedCount: number
  /** Protocolos dos outros eventos onde esses clientes já estavam. */
  eventProtocols: number[]
}

/**
 * Tira da seleção os clientes que já fazem parte de OUTRO evento aberto: eles não entram de
 * novo (não duplica a linha em assignment_clients) e a abertura segue normalmente. Consulta
 * de novo no momento do envio, porque outra pessoa pode ter aberto um evento depois do aviso.
 * Se o operador escolheu incluí-los mesmo assim, ou se a consulta falhar, nada é removido
 * (a falha nunca bloqueia a abertura).
 */
export async function excludeClientsInOtherEvents(
  context: MassivaOpenFinalContext,
  signal?: AbortSignal,
): Promise<ClientExclusionResult> {
  const unchanged: ClientExclusionResult = { context, excludedCount: 0, eventProtocols: [] }
  if (context.includeConflictingClients === true) return unchanged

  const contractIds = [
    ...new Set(collectMapeableAfetadosClientes(context.basis.collectedClientes).map((c) => c.contract!.id)),
  ]
  if (contractIds.length === 0) return unchanged

  let conflicts
  try {
    conflicts = await fetchMassivaClientConflicts(contractIds, signal)
  } catch (error) {
    console.warn('[Massiva] Não foi possível conferir clientes em outro evento; seguindo sem exclusão.', error)
    return unchanged
  }
  if (conflicts.contractIds.length === 0) return unchanged

  const conflictSet = buildConflictContractSet(conflicts.contractIds)
  const { kept } = partitionClientesByConflicts(context.basis.collectedClientes, conflictSet)
  const excludedCount = contractIds.filter((id) => conflictSet.has(id)).length
  if (excludedCount === 0) return unchanged

  return {
    context: { ...context, basis: { ...context.basis, collectedClientes: kept } },
    excludedCount,
    eventProtocols: conflicts.events.map((e) => e.protocol),
  }
}
