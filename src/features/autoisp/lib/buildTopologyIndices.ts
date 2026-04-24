import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { TopologyIndices, RouteCatalog, RouteByUsernameMap } from '@/features/autoisp/model/topology.types'

/**
 * Constrói os índices de topologia a partir da lista FLAT de conexões.
 * Mais eficiente para o padrão do React onde já temos o array completo.
 */
export function buildTopologyIndicesFromConnections(
  connections: SplitterCliente[]
): TopologyIndices {
  const routeCatalog: RouteCatalog = {}
  const routeByUsername: RouteByUsernameMap = {}
  const apTitleByCode: Record<string, string> = {}

  for (const cliente of connections) {
    const access = cliente.accessPoint
    if (!access) continue

    const apCode = access.code.trim()
    const apTitle = access.title.trim()
    if (!apCode || !apTitle) continue

    const slot = access.slotOlt
    const port = access.portOlt
    
    // Fallback: se o cliente não tem splitterCode, ele não entra na contagem de splitters da rota (Set)
    const splitterCode = cliente.splitterCode?.trim()

    // 1. Popula o catálogo de rotas
    if (!routeCatalog[apCode]) routeCatalog[apCode] = {}
    if (!routeCatalog[apCode][slot]) routeCatalog[apCode][slot] = {}
    if (!routeCatalog[apCode][slot][port]) routeCatalog[apCode][slot][port] = new Set()
    
    if (splitterCode) {
      routeCatalog[apCode][slot][port].add(splitterCode)
    }
    
    // 2. Guarda o título do AP
    if (!apTitleByCode[apCode]) apTitleByCode[apCode] = apTitle

    // 3. Popula o índice por username
    const normalizedUser = cliente.user.trim().toLowerCase()
    if (normalizedUser) {
      if (!routeByUsername[normalizedUser]) {
        routeByUsername[normalizedUser] = {
          ap: apCode,
          slot,
          port,
          splitterCode: splitterCode || null,
          username: cliente.user.trim(),
        }
      }
    }
  }

  return {
    routeCatalog,
    routeByUsername,
    apTitleByCode,
  }
}

/**
 * Constrói os índices de topologia em memória para busca rápida.
 * Paridade com `_ensureRouteCatalog` da `massiva_screen.dart`.
 */
export function buildTopologyIndices(
  splitters: Splitter[],
  getClientesForSplitter: (splitterCode: string) => SplitterCliente[]
): TopologyIndices {
  const allConnections: SplitterCliente[] = []
  for (const s of splitters) {
    allConnections.push(...getClientesForSplitter(s.code))
  }
  return buildTopologyIndicesFromConnections(allConnections)
}

