import { listMassivaSplittersForRoute } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { massivaPreviewNormalizedRoutes } from '@/features/massiva/lib/massivaPreviewSelectionMaps'
import type {
  MassivaLocalPreviewRouteSelection,
  MassivaRouteCatalog,
} from '@/features/massiva/model/massivaLocalPreview'

/**
 * Splitters efetivos da selecao: uniao de todas as rotas completas selecionadas.
 */
export function resolveEffectiveMassivaSplitterCodes(
  selection: MassivaLocalPreviewRouteSelection,
  catalog: MassivaRouteCatalog,
): string[] {
  const merged = new Set<string>()

  for (const route of massivaPreviewNormalizedRoutes(selection)) {
    if (route.splitterCodes.length > 0) {
      for (const code of route.splitterCodes) merged.add(code)
      continue
    }

    const fromCatalog = listMassivaSplittersForRoute(
      catalog,
      route.apCode,
      route.slot,
      route.port,
    )

    for (const code of fromCatalog) merged.add(code)
  }

  return [...merged].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}
