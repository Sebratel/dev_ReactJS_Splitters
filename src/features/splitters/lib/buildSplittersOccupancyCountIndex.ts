import { buildSplittersConnectionsDerivedIndexes } from '@/features/splitters/lib/buildSplittersConnectionsDerivedIndexes'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/**
 * Contagem de conexões por código de splitter — paridade `_ocupacaoSnapshot` / comprimento da lista por
 * código na Home Flutter.
 */
export type SplittersOccupancyCountIndex = ReadonlyMap<string, number>

/**
 * Delega a `buildSplittersConnectionsDerivedIndexes` (uma passagem na lista).
 */
export function buildSplittersOccupancyCountIndex(
  connections: readonly SplitterCliente[],
): SplittersOccupancyCountIndex {
  return buildSplittersConnectionsDerivedIndexes(connections)
    .occupancyCountBySplitterCode
}
