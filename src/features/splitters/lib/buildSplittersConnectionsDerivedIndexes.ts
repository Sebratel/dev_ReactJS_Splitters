import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { SplittersClientNamesIndex } from '@/features/splitters/model/splitterListFilterRowContext'

export type SplittersConnectionsDerivedIndexes = {
  clientNamesIndex: SplittersClientNamesIndex
  occupancyCountBySplitterCode: ReadonlyMap<string, number>
}

/**
 * Uma única passagem sobre `listarConnections` — antes o hook fazia duas (`buildSplittersClientNamesIndex` +
 * `buildSplittersOccupancyCountIndex`). Importante para listas grandes.
 */
export function buildSplittersConnectionsDerivedIndexes(
  connections: readonly SplitterCliente[],
): SplittersConnectionsDerivedIndexes {
  const byCodeNames = new Map<string, Set<string>>()
  const counts = new Map<string, number>()

  for (const c of connections) {
    const code = c.splitterCode?.trim()
    if (!code) continue

    counts.set(code, (counts.get(code) ?? 0) + 1)

    const name = c.name.trim().toLowerCase()
    if (name.length === 0) continue

    let bucket = byCodeNames.get(code)
    if (bucket === undefined) {
      bucket = new Set()
      byCodeNames.set(code, bucket)
    }
    bucket.add(name)
  }

  const clientNamesIndex: Map<string, readonly string[]> = new Map()
  for (const [code, set] of byCodeNames) {
    clientNamesIndex.set(code, [...set].sort((a, b) => a.localeCompare(b, 'pt-BR')))
  }

  return {
    clientNamesIndex,
    occupancyCountBySplitterCode: counts,
  }
}
