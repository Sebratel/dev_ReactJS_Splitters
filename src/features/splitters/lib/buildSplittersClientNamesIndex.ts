import { buildSplittersConnectionsDerivedIndexes } from '@/features/splitters/lib/buildSplittersConnectionsDerivedIndexes'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { SplittersClientNamesIndex } from '@/features/splitters/model/splitterListFilterRowContext'

/**
 * Agrupa nomes de clientes por `splitterCode` em minúsculas (paridade `_buildClientesIndex` /
 * `_clientesPorSplitter` na Home Flutter — valores usados em `n.contains(query)`).
 *
 * Implementação delega a `buildSplittersConnectionsDerivedIndexes` (uma passagem na lista).
 */
export function buildSplittersClientNamesIndex(
  connections: readonly SplitterCliente[],
): SplittersClientNamesIndex {
  return buildSplittersConnectionsDerivedIndexes(connections).clientNamesIndex
}
