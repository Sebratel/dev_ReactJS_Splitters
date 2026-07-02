import { useQuery } from '@tanstack/react-query'
import {
  fetchSplitterCancellations,
  type SplitterCancellationsParams,
} from '@/features/cancellations/api/fetchSplitterCancellations'

/**
 * Cancelamentos de um splitter (por título). Desabilita quando não há título.
 * Cache de 10min no BFF; staleTime de 5min no cliente.
 */
export function useSplitterCancellations(params: SplitterCancellationsParams | null) {
  return useQuery({
    queryKey: [
      'cancellations',
      'by-splitter',
      params?.title ?? '',
      params?.startIso ?? '',
      params?.eventAt ?? '',
      params?.windowDays ?? 30,
    ],
    queryFn: () => fetchSplitterCancellations(params!),
    enabled: params != null && params.title.trim() !== '',
    staleTime: 5 * 60_000,
  })
}
