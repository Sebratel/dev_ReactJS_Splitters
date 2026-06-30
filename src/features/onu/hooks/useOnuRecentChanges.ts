import { useQuery } from '@tanstack/react-query'
import { fetchOnuRecentChanges } from '@/features/onu/api/fetchOnuRecentChanges'
import { onuKeys, ONU_POLL_INTERVAL_MS } from '@/features/onu/model/onuKeys'
import type { OnuRecentChanges } from '@/features/onu/model/onuStatusChange'

/**
 * Feed de quedas/recuperações recentes, com polling (30s). O servidor cacheia
 * por 15s, então o polling é barato e o feed fica próximo do tempo real.
 */
export function useOnuRecentChanges(options?: { enabled?: boolean }) {
  return useQuery<OnuRecentChanges | null>({
    queryKey: [...onuKeys.all, 'recent-changes'],
    queryFn: fetchOnuRecentChanges,
    enabled: options?.enabled ?? true,
    staleTime: ONU_POLL_INTERVAL_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
    refetchOnWindowFocus: false,
  })
}
