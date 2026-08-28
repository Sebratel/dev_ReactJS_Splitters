import { useMemo } from 'react'
import { Shield } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listSplittersUsers,
  updateSplittersUserPermissions,
} from '@/features/access/api/firestoreUsers'
import {
  listPendingSplittersAccessRequests,
  resolveSplittersAccessRequest,
} from '@/features/access/api/firestoreAccessRequests'
import { accessRequestQueryKeys } from '@/features/access/model/accessRequestKeys'
import { applySplittersRolePreset, SPLITTERS_ROLE_LABEL } from '@/features/access/lib/splittersUserRoles'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { AccessDeniedState } from '@/features/access/ui/AccessDeniedState'
import { UsersManagementWorkspace } from '@/features/access/ui/UsersManagementWorkspace'
import { AppPageHeader } from '@/shared/ui/AppPageHeader'

const usersQueryKey = ['splitters-users-firestore'] as const

export function UsersManagementPage() {
  const profile = useAccessAuthStore((s) => s.profile)
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const queryClient = useQueryClient()

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: listSplittersUsers,
    enabled: isAdmin,
  })

  const accessPendingQuery = useQuery({
    queryKey: accessRequestQueryKeys.pending(),
    queryFn: listPendingSplittersAccessRequests,
    enabled: isAdmin,
    refetchInterval: 60_000,
  })

  const updateMutation = useMutation({
    mutationFn: updateSplittersUserPermissions,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })

  const resolveAccessMutation = useMutation({
    mutationFn: resolveSplittersAccessRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: accessRequestQueryKeys.all })
      await queryClient.invalidateQueries({ queryKey: usersQueryKey })
    },
  })

  const sortedUsers = useMemo(() => {
    const list = usersQuery.data ?? []
    return [...list].sort((a, b) => a.email.localeCompare(b.email, 'pt-BR'))
  }, [usersQuery.data])

  if (!isAdmin) {
    return (
      <AccessDeniedState description="Somente administradores podem gerenciar usuários e permissões do Splitters." />
    )
  }

  return (
    <div className="mx-auto max-w-[1480px] min-w-0 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <AppPageHeader
        icon={Shield}
        badge="Administração"
        title="Gestão de usuários"
        description="Usuários autenticados no Splitters com permissões por módulo (visualização e abertura de massivas)."
        primaryAction={{ to: '/', label: 'Voltar ao painel' }}
      />

      {usersQuery.isError ? (
        <div className="rounded-xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          Falha ao carregar usuários:{' '}
          {usersQuery.error instanceof Error ? usersQuery.error.message : 'erro inesperado'}
        </div>
      ) : (
        <UsersManagementWorkspace
          users={sortedUsers}
          currentUid={profile?.uid}
          pending={updateMutation.isPending}
          isInitialLoading={usersQuery.isLoading}
          onSaveUser={(payload) => updateMutation.mutate(payload)}
          accessRequests={{
            items: accessPendingQuery.data ?? [],
            loading: accessPendingQuery.isLoading,
            error: accessPendingQuery.isError
              ? accessPendingQuery.error instanceof Error
                ? accessPendingQuery.error.message
                : 'Falha ao carregar solicitações.'
              : null,
            busy: resolveAccessMutation.isPending,
            onApprove: ({ requestId, role }) => {
              const reviewerUid = profile?.uid
              if (!reviewerUid) return
              resolveAccessMutation.mutate({
                requestId,
                decision: 'approved',
                reviewerUid,
                grantedPermissions: applySplittersRolePreset(role),
                adminNote: `Aprovado como ${SPLITTERS_ROLE_LABEL[role]}.`,
              })
            },
            onReject: ({ requestId, adminNote }) => {
              const reviewerUid = profile?.uid
              if (!reviewerUid) return
              resolveAccessMutation.mutate({
                requestId,
                decision: 'rejected',
                reviewerUid,
                adminNote: adminNote || undefined,
              })
            },
          }}
        />
      )}
    </div>
  )
}
