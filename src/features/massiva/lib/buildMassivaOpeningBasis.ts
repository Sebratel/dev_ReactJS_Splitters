import { listMassivaSplittersForRoute } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { collectMassivaClientesForTopology } from '@/features/massiva/lib/collectMassivaClientesForTopology'
import { estimateFlutterStyleAffectedUsersQuantity } from '@/features/massiva/lib/estimateFlutterStyleAffectedUsersQuantity'
import { massivaPreviewTotalsFromClientes } from '@/features/massiva/lib/massivaPreviewTotalsFromClientes'
import {
  massivaPreviewNormalizedRoutes,
  massivaPreviewSelectedAps,
  massivaPreviewSelectionToExplicitSplitters,
  massivaPreviewSelectionToPortsByApSlot,
} from '@/features/massiva/lib/massivaPreviewSelectionMaps'
import type {
  MassivaOpeningBasis,
  MassivaRouteConnectionResolved,
  MassivaSplitterDisplayEntry,
} from '@/features/massiva/model/massivaOpeningBasis'
import type {
  MassivaLocalPreviewRouteSelection,
  MassivaRouteCatalog,
} from '@/features/massiva/model/massivaLocalPreview'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function uniqueAuthIdsOnRoute(clientes: readonly SplitterCliente[]): number[] {
  const ids = new Set<number>()
  for (const cliente of clientes) {
    if (cliente.authenticationId > 0) ids.add(cliente.authenticationId)
  }
  return [...ids].sort((a, b) => a - b)
}

function resolveSplitterLabel(
  code: string,
  catalog: MassivaRouteCatalog,
  clientes: readonly SplitterCliente[],
): string {
  const fromCatalog = catalog.splitterTitles.get(code)?.trim()
  if (fromCatalog && fromCatalog.length > 0) return fromCatalog

  for (const cliente of clientes) {
    if (cliente.splitterCode === code) {
      const title = cliente.splitterTitle?.trim()
      if (title) return title
    }
  }

  return code
}

function buildEffectiveSplitterDisplay(
  codes: string[],
  catalog: MassivaRouteCatalog,
  clientes: readonly SplitterCliente[],
): MassivaSplitterDisplayEntry[] {
  return codes.map((code) => ({
    code,
    label: resolveSplitterLabel(code, catalog, clientes),
  }))
}

function buildResolvedTopologyRoutes(
  selection: MassivaLocalPreviewRouteSelection,
  catalog: MassivaRouteCatalog,
  apDisplayLabel: (apCode: string) => string,
  collectedClientes: readonly SplitterCliente[],
): MassivaRouteConnectionResolved[] {
  return massivaPreviewNormalizedRoutes(selection).map((route) => {
    const effectiveSplitterCodes = route.splitterCodes.length > 0
      ? route.splitterCodes
      : listMassivaSplittersForRoute(catalog, route.apCode, route.slot, route.port)

    return {
      apCode: route.apCode,
      apDisplayTitle: apDisplayLabel(route.apCode),
      slot: route.slot,
      port: route.port,
      effectiveSplitterCodes,
      effectiveSplitterDisplay: buildEffectiveSplitterDisplay(
        effectiveSplitterCodes,
        catalog,
        collectedClientes,
      ),
    }
  })
}

/**
 * Consolida selecao + `listarConnections` em estrutura consumivel pela abertura (sem POST).
 */
export function buildMassivaOpeningBasis(
  selection: MassivaLocalPreviewRouteSelection,
  catalog: MassivaRouteCatalog,
  connections: readonly SplitterCliente[],
  apDisplayLabel: (apCode: string) => string,
): MassivaOpeningBasis {
  const selectedAps = massivaPreviewSelectedAps(selection)
  const portsByApSlot = massivaPreviewSelectionToPortsByApSlot(selection)
  const explicit = massivaPreviewSelectionToExplicitSplitters(selection)

  const collectedClientes = collectMassivaClientesForTopology(
    selectedAps,
    portsByApSlot,
    explicit,
    catalog,
    connections,
  )

  const topologyRoutes = buildResolvedTopologyRoutes(
    selection,
    catalog,
    apDisplayLabel,
    collectedClientes,
  )

  const mergedSplitterCodes = new Set<string>()
  for (const route of topologyRoutes) {
    for (const code of route.effectiveSplitterCodes) {
      mergedSplitterCodes.add(code)
    }
  }

  const previewTotals = massivaPreviewTotalsFromClientes(collectedClientes)
  const uniqueAuthenticationIdsOnRoute = uniqueAuthIdsOnRoute(collectedClientes)
  const flutterStyleAffectedUsersQuantity = estimateFlutterStyleAffectedUsersQuantity(
    [...mergedSplitterCodes],
    connections,
  )

  return {
    topology: {
      routes: topologyRoutes,
    },
    collectedClientes,
    previewTotals,
    uniqueAuthenticationIdsOnRoute,
    flutterStyleAffectedUsersQuantity,
  }
}
