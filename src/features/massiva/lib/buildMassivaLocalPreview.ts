import { collectMassivaClientesForTopology } from '@/features/massiva/lib/collectMassivaClientesForTopology'
import { massivaPreviewTotalsFromClientes } from '@/features/massiva/lib/massivaPreviewTotalsFromClientes'
import type {
  MassivaLocalPreviewTotals,
  MassivaRouteCatalog,
} from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const DEFAULT_SAMPLE_LIMIT = 12

/**
 * Paridade `_buildLocalPreview`: agrega por `selectedAps` + `_collectClientesForAp`.
 */
export function buildMassivaLocalPreview(
  selectedAps: readonly string[],
  portsByApSlot: ReadonlyMap<string, ReadonlyMap<number, ReadonlySet<number>>>,
  explicitSplittersByRoute:
    | ReadonlyMap<
        string,
        ReadonlyMap<number, ReadonlyMap<number, ReadonlySet<string>>>
      >
    | undefined,
  catalog: MassivaRouteCatalog,
  connections: SplitterCliente[],
  sampleLimit = DEFAULT_SAMPLE_LIMIT,
): { totals: MassivaLocalPreviewTotals; sampleClientes: SplitterCliente[] } {
  const merged = collectMassivaClientesForTopology(
    selectedAps,
    portsByApSlot,
    explicitSplittersByRoute,
    catalog,
    connections,
  )
  const totals = massivaPreviewTotalsFromClientes(merged)
  const sampleClientes = merged.slice(0, sampleLimit)
  return { totals, sampleClientes }
}
