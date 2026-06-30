import { useQuery } from '@tanstack/react-query'
import { fetchOnuSummaryBySplitter } from '@/features/onu/api/fetchOnuSummaryBySplitter'
import { onuKeys, ONU_POLL_INTERVAL_MS, ONU_STALE_TIME_MS } from '@/features/onu/model/onuKeys'
import type { OnuSplitterSignalSummary } from '@/features/onu/model/onuSplitterSummary'

/**
 * Resumo de sinal ONU agregado por código de splitter. Uma única query para toda
 * a listagem — o BFF retorna um mapa { splitterCode → { avg, online, degraded, offline } }
 * com cache de 60s no servidor, sem custo extra por card.
 */
export function useOnuSummaryBySplitter() {
  return useQuery<Map<string, OnuSplitterSignalSummary>>({
    queryKey: onuKeys.summaryBySplitter(),
    queryFn: fetchOnuSummaryBySplitter,
    staleTime: ONU_STALE_TIME_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
  })
}
