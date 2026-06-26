import { useQuery } from '@tanstack/react-query'
import {
  fetchOnuDiagnostic,
  fetchOnuDiagnosticsBatch,
} from '@/features/onu/api/fetchOnuDiagnostic'
import {
  onuKeys,
  ONU_POLL_INTERVAL_MS,
  ONU_STALE_TIME_MS,
} from '@/features/onu/model/onuKeys'
import type { OnuDiagnostic } from '@/features/onu/model/onuDiagnostic'

/**
 * Diagnóstico da ONU de um cliente, com polling automático (60s) para refletir
 * o status quase em tempo real. Passe o `user` (PPPoE) do cliente.
 */
export function useOnuDiagnostic(
  username: string | null | undefined,
  options?: { enabled?: boolean },
) {
  const normalized = (username ?? '').trim()
  const enabled = (options?.enabled ?? true) && normalized.length > 0

  return useQuery<OnuDiagnostic | null>({
    queryKey: enabled
      ? onuKeys.byUsername(normalized)
      : [...onuKeys.all, 'by-username', '__none__'],
    queryFn: () => fetchOnuDiagnostic(normalized),
    enabled,
    staleTime: ONU_STALE_TIME_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
  })
}

/**
 * Diagnóstico em lote para a lista de clientes de um splitter, com polling.
 * Retorna um `Map<username, OnuDiagnostic>`.
 */
export function useOnuDiagnosticsBatch(
  usernames: readonly string[],
  options?: { enabled?: boolean },
) {
  const list = Array.from(
    new Set(usernames.map((u) => String(u ?? '').trim()).filter(Boolean)),
  )
  const enabled = (options?.enabled ?? true) && list.length > 0

  return useQuery<Map<string, OnuDiagnostic>>({
    queryKey: onuKeys.batch(list),
    queryFn: () => fetchOnuDiagnosticsBatch(list),
    enabled,
    staleTime: ONU_STALE_TIME_MS,
    refetchInterval: ONU_POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
  })
}
