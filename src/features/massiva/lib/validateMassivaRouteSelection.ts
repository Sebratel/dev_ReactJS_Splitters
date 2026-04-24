import { listMassivaSplittersForRoute } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { massivaPreviewNormalizedRoutes } from '@/features/massiva/lib/massivaPreviewSelectionMaps'
import type {
  MassivaLocalPreviewRouteSelection,
  MassivaRouteCatalog,
} from '@/features/massiva/model/massivaLocalPreview'

/**
 * Valida seleção para preview e abertura.
 * Não exige splitters explícitos: se a rota estiver completa, usa-se a lista da rota.
 */
export function getMassivaRouteSelectionIssues(
  selection: MassivaLocalPreviewRouteSelection,
  availableApCount: number,
  catalog: MassivaRouteCatalog,
): string[] {
  const issues: string[] = []

  if (availableApCount === 0) {
    issues.push('Não há pontos de acesso com clientes nas conexões carregadas.')
    return issues
  }

  if (selection.connections.length === 0) {
    issues.push('Adicione ao menos uma rota (AP, slot e porta).')
    return issues
  }

  selection.connections.forEach((route, index) => {
    const routeNumber = index + 1
    const ap = route.apId.trim()

    if (ap === '') {
      issues.push(`Rota ${routeNumber}: selecione o ponto de acesso (AP).`)
      return
    }

    if (route.slot === null) {
      issues.push(`Rota ${routeNumber}: selecione o slot da OLT.`)
      return
    }

    if (route.porta === null) {
      issues.push(`Rota ${routeNumber}: selecione a porta da OLT.`)
      return
    }

    const explicit = route.splitters
      .map((s) => s.id.trim())
      .filter((s) => s !== '')
    const effective = explicit.length > 0
      ? explicit
      : listMassivaSplittersForRoute(catalog, ap, route.slot, route.porta)

    if (effective.length === 0) {
      issues.push(
        `Rota ${routeNumber}: nenhum splitter resolvido para AP ${ap}, slot ${route.slot}, porta ${route.porta}.`,
      )
    }
  })

  const normalizedRoutes = massivaPreviewNormalizedRoutes(selection)
  if (normalizedRoutes.length === 0) {
    issues.push('Finalize ao menos uma rota completa (AP, slot e porta).')
  }

  return issues
}
