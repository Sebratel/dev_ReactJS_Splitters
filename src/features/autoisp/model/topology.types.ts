/**
 * Informação de rota resolvida a partir de um evento de rede.
 * Paridade com `_ResolvedAutoIspRoute` do Flutter.
 */
export interface ResolvedAutoIspRoute {
  ap: string
  slot: number
  port: number
  splitterCode: string | null
  username: string | null
}

/**
 * Catálogo de rotas indexado para busca rápida O(1).
 * AP -> Slot -> Port -> Set<SplitterCode>
 */
export type RouteCatalog = Record<string, Record<number, Record<number, Set<string>>>>

/**
 * Índice de busca por PPPoE.
 * Username -> ResolvedAutoIspRoute
 */
export type RouteByUsernameMap = Record<string, ResolvedAutoIspRoute>

/**
 * Estrutura consolidada de índices de topologia.
 */
export interface TopologyIndices {
  routeCatalog: RouteCatalog
  routeByUsername: RouteByUsernameMap
  apTitleByCode: Record<string, string>
}
