import type { MassivaRouteCatalog } from '@/features/massiva/model/massivaLocalPreview'
import { listMassivaSplittersForRoute } from '@/features/massiva/lib/buildMassivaRouteCatalog'

/**
 * Paridade `_effectiveSplittersForRoute`: conjunto explícito não vazio substitui o catálogo;
 * caso contrário usa `_splitterOptionsForRoute`.
 */
export function effectiveMassivaSplittersForRoute(
  catalog: MassivaRouteCatalog,
  apCode: string,
  slot: number,
  port: number,
  explicit: ReadonlySet<string> | undefined,
): Set<string> {
  if (explicit !== undefined && explicit.size > 0) {
    return new Set(explicit)
  }
  return new Set(listMassivaSplittersForRoute(catalog, apCode, slot, port))
}
