import { collectMassivaClientesForAp } from '@/features/massiva/lib/collectMassivaClientesForAp'
import { buildSplitterConnectionsIndex } from '@/features/massiva/lib/filterConnectionsBySplitterCode'
import { massivaClientDedupeKey } from '@/features/massiva/lib/massivaClientDedupeKey'
import type { MassivaRouteCatalog } from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

/**
 * União deduplicada dos clientes de todos os APs selecionados (paridade agregação em `_buildLocalPreview`).
 */
export function collectMassivaClientesForTopology(
  selectedAps: readonly string[],
  portsByApSlot: ReadonlyMap<string, ReadonlyMap<number, ReadonlySet<number>>>,
  explicitSplittersByRoute:
    | ReadonlyMap<
        string,
        ReadonlyMap<number, ReadonlyMap<number, ReadonlySet<string>>>
      >
    | undefined,
  catalog: MassivaRouteCatalog,
  connections: readonly SplitterCliente[],
): SplitterCliente[] {
  const seenKeys = new Set<string>()
  const out: SplitterCliente[] = []
  const splitterIndex = buildSplitterConnectionsIndex(connections)

  for (const apCode of selectedAps) {
    const list = collectMassivaClientesForAp(
      apCode,
      portsByApSlot,
      explicitSplittersByRoute,
      catalog,
      connections,
      splitterIndex,
    )
    for (const c of list) {
      const k = massivaClientDedupeKey(c)
      if (seenKeys.has(k)) continue
      seenKeys.add(k)
      out.push(c)
    }
  }

  return out
}
