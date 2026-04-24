/** Paridade com `SplitterService.cacheTtl` no Flutter (5 minutos). */
const SPLITTER_SERVICE_CACHE_TTL_MS = 5 * 60 * 1000

export const SPLITTERS_LIST_STALE_TIME_MS = SPLITTER_SERVICE_CACHE_TTL_MS

/** Lista global de conexões (`listarConnections`), mesmo TTL em memória/Hive no Flutter. */
export const SPLITTERS_CONNECTIONS_STALE_TIME_MS = SPLITTER_SERVICE_CACHE_TTL_MS
