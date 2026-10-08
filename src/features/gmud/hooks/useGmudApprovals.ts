import { useQuery } from '@tanstack/react-query'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { fetchPendingGmuds, fetchPendingGmudCount } from '@/features/gmud/api/gmudApprovals'

/** Fila de GMUDs pendentes de aprovação (só para quem aprova). */
export function usePendingGmuds(enabled: boolean) {
  return useQuery({
    queryKey: ['gmud', 'pending'],
    queryFn: fetchPendingGmuds,
    enabled,
    staleTime: 15_000,
  })
}

/** Contador de GMUDs pendentes — para o badge do menu. Só busca se o usuário puder aprovar. */
export function useGmudPendingCount() {
  const canApprove = useAccessAuthStore((s) => s.hasPermission('canApproveGmud'))
  const query = useQuery({
    queryKey: ['gmud', 'pending-count'],
    queryFn: fetchPendingGmudCount,
    enabled: canApprove,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
  return canApprove ? (query.data ?? 0) : 0
}
