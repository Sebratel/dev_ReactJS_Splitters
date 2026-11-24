import type { Splitter } from '@/features/splitters/model/splitter'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { TopologyIndices, RouteCatalog, RouteByUsernameMap } from '@/features/autoisp/model/topology.types'
import type { MassivaRouteRow } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'

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
 * Índices do painel AutoISP sem a base inteira de conexões:
 *  - `routeByUsername` vem da consulta por PPPoE (só os PPPoE dos eventos em tela);
 *  - o catálogo AP -> slot -> porta -> splitters (fallback por ponlink) vem das rotas
 *    distintas (`GET /api/massiva/routes`), que já alimentam o assistente de massiva.
 * O que veio das conexões tem precedência (o título do AP inclui a OLT, como antes).
 */
export function buildTopologyIndicesFromLookup(
  connections: SplitterCliente[],
  routes: readonly MassivaRouteRow[],
): TopologyIndices {
  const indices = buildTopologyIndicesFromConnections(connections)

  for (const route of routes) {
    const apCode = route.apCode.trim()
    const apTitle = route.apTitle.trim()
    if (!apCode || !apTitle) continue

    const catalog = indices.routeCatalog
    if (!catalog[apCode]) catalog[apCode] = {}
    if (!catalog[apCode][route.slot]) catalog[apCode][route.slot] = {}
    if (!catalog[apCode][route.slot][route.port]) catalog[apCode][route.slot][route.port] = new Set()

    const splitterCode = route.splitterCode.trim()
    if (splitterCode) catalog[apCode][route.slot][route.port].add(splitterCode)

    if (!indices.apTitleByCode[apCode]) {
      const olt = route.oltTitle?.trim()
      indices.apTitleByCode[apCode] = olt ? `${olt} / ${apTitle}` : apTitle
    }
  }

  return indices
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

