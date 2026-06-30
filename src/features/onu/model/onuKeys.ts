/**
 * Chaves TanStack Query da feature `onu` (diagnóstico de sinal).
 */
export const onuKeys = {
  all: ['onu'] as const,
  /** Diagnóstico de uma ONU pelo usuário PPPoE. */
  byUsername: (username: string) =>
    [...onuKeys.all, 'by-username', username] as const,
  /** Diagnóstico em lote (cards da lista de clientes). */
  batch: (usernames: readonly string[]) =>
    [...onuKeys.all, 'batch', [...usernames].sort().join('|')] as const,
  /** Resumo agregado por splitter (listagem principal). */
  summaryBySplitter: () => [...onuKeys.all, 'summary-by-splitter'] as const,
  /** Saúde de sinal agregada por modelo de ONU. */
  byModel: () => [...onuKeys.all, 'by-model'] as const,
}

/**
 * Intervalo de polling (ms). O up/down no banco de monitoramento é atualizado
 * em ~1 min (via trap/alarme da OLT), então 30s mantém o status próximo do
 * tempo real sem peso — as leituras são leves (índices por username).
 */
export const ONU_POLL_INTERVAL_MS = 30_000
/** Tempo até considerar o dado "stale" e permitir refetch em foco. */
export const ONU_STALE_TIME_MS = 15_000
