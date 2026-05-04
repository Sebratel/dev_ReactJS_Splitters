/**
 * Única fonte de query keys TanStack Query para a feature `splitters`.
 *
 * Não criar `queryKeys.ts` paralelo nem espalhar arrays literais em hooks —
 * novas queries entram aqui como `splittersKeys.novoEscopo(...)`.
 */
export const splittersKeys = {
  all: ['splitters'] as const,

  /** Lista completa de splitters (BFF `listarSplitters`). */
  list: () => [...splittersKeys.all, 'list'] as const,

  /** Top splitters por risco sobre o universo filtrado (consulta dedicada). */
  operationalPriorityQueue: () => [...splittersKeys.all, 'operational-priority-queue'] as const,

  /** Detalhe por código do splitter. */
  detail: (code: string) => [...splittersKeys.all, 'detail', code] as const,

  /** Lista global de conexões (BFF `listarConnections`). */
  connections: () => [...splittersKeys.all, 'connections'] as const,

  /** Lista global de OLTs (BFF `listarOlts`). */
  olts: () => [...splittersKeys.all, 'olts'] as const,

  /** Lista global de pontos de acesso usados no filtro da listagem. */
  accessPointsForFilters: () => [...splittersKeys.all, 'access-points-for-filters'] as const,

  /** Histórico local de massivas agregado por splitter. */
  massivaHistoryBySplitters: (codes: readonly string[]) =>
    [...splittersKeys.all, 'massiva-history-by-splitters', ...codes] as const,

  /** Códigos de splitters que possuem massiva aberta no histórico local. */
  openMassivaSplitterCodes: () => [...splittersKeys.all, 'open-massiva-splitter-codes'] as const,

  /** Tendências agregadas por splitter a partir dos snapshots diários. */
  trendsBySplitters: (codes: readonly string[]) =>
    [...splittersKeys.all, 'trends-by-splitters', ...codes] as const,

  /** Lista global de splitters primários para filtro. */
  primarySplitters: () => [...splittersKeys.all, 'primary-splitters'] as const,

  /** Opções globais para filtros de rua/cidade/condomínio. */
  filterOptions: () => [...splittersKeys.all, 'filter-options'] as const,

  /** Vizinhos do mapa por código de splitter e raio. */
  mapNeighbors: (code: string, radiusMeters: number) =>
    [...splittersKeys.all, 'map-neighbors', code, radiusMeters] as const,

  /** Endereço resolvido por lat/lng. */
  geocode: (splitterCode: string) =>
    [...splittersKeys.all, 'geocode', splitterCode] as const,

  /** Portas GeoGrid + nomes de clientes por `integrationCode` do splitter. */
  geogrid: (integrationCode: string) =>
    [...splittersKeys.all, 'geogrid', integrationCode] as const,

  /** Comparativo cliente/porta com `clientesAtendimentos` do GeoGrid por splitter. */
  geogridComparison: (splitterCode: string, names: readonly string[]) =>
    [...splittersKeys.all, 'geogrid-comparison', splitterCode, ...names] as const,
}
