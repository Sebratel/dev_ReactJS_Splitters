import { useQuery } from '@tanstack/react-query'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { listPendingSplittersAccessRequests } from '@/features/access/api/firestoreAccessRequests'
import { useHomeDashboardMassivaOpen } from '@/features/massiva/hooks/useHomeDashboardMassivaOpen'

export type AppNotificationTone = 'danger' | 'warning' | 'info'

export type AppNotification = {
  id: string
  title: string
  description: string
  count: number
  to: string
  tone: AppNotificationTone
}

/**
 * Centro de notificações do topbar. Agrega dados que JÁ existem no app, cada um
 * respeitando a permissão do usuário:
 * - Massivas abertas agora (quem tem acesso a Massivas).
 * - Solicitações de acesso aguardando aprovação (somente admin).
 *
 * Retorna a lista de itens acionáveis e o total (para o contador do sino).
 */
export function useAppNotifications(): {
  items: AppNotification[]
  total: number
  isLoading: boolean
} {
  const canViewMassiva = useAccessAuthStore((s) => s.hasPermission('canViewMassiva'))
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))

  // Já usado no dashboard; seguro chamar para qualquer usuário.
  const { openCount } = useHomeDashboardMassivaOpen()

  const pendingRequests = useQuery({
    queryKey: ['app-notifications', 'pending-access-requests'],
    queryFn: listPendingSplittersAccessRequests,
    enabled: isAdmin,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
  const pendingCount = pendingRequests.data?.length ?? 0

  const items: AppNotification[] = []

  if (canViewMassiva && openCount > 0) {
    items.push({
      id: 'massivas-abertas',
      title: 'Massivas abertas',
      description: `${openCount} em andamento agora`,
      count: openCount,
      to: '/massiva',
      tone: 'danger',
    })
  }

  if (isAdmin && pendingCount > 0) {
    items.push({
      id: 'solicitacoes-acesso',
      title: 'Solicitações de acesso',
      description: `${pendingCount} aguardando aprovação`,
      count: pendingCount,
      to: '/usuarios',
      tone: 'info',
    })
  }

  const total = items.reduce((sum, item) => sum + item.count, 0)

  return { items, total, isLoading: isAdmin && pendingRequests.isLoading }
}
