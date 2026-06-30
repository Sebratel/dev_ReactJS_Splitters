import { useQuery } from '@tanstack/react-query'
import { fetchOnuSignalByModel } from '@/features/onu/api/fetchOnuSignalByModel'
import { onuKeys, ONU_POLL_INTERVAL_MS, ONU_STALE_TIME_MS } from '@/features/onu/model/onuKeys'
import type { OnuSignalByModel } from '@/features/onu/model/onuSignalByModel'

/** Saúde de sinal das ONUs por modelo, com polling (alinhado ao demais ONU). */
export function useOnuSignalByModel() {
  return useQuery<OnuSignalByModel>({
    queryKey: onuKeys.byModel(),
    queryFn: ({ signal }) => fetchOnuSignalByModel(signal),
    staleTime: ONU_STALE_TIME_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}
