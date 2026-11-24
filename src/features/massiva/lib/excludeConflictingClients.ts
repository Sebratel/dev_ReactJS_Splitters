import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/** Conjunto de contratos que já estão em outro evento. */
export function buildConflictContractSet(contractIds: readonly number[]): Set<number> {
  return new Set(contractIds.filter((id) => Number.isInteger(id) && id > 0))
}

/**
 * Separa os clientes da seleção em os que vão e os que ficam de fora (já estão em outro evento).
 * Cliente sem contrato nunca é excluído por aqui (já não entra no POST de afetados).
 */
export function partitionClientesByConflicts(
  clientes: readonly SplitterCliente[],
  conflictContractIds: ReadonlySet<number>,
): { kept: SplitterCliente[]; excluded: SplitterCliente[] } {
  const kept: SplitterCliente[] = []
  const excluded: SplitterCliente[] = []
  for (const c of clientes) {
    const contractId = c.contract?.id
    if (contractId != null && conflictContractIds.has(contractId)) excluded.push(c)
    else kept.push(c)
  }
  return { kept, excluded }
}
