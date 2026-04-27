import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  listSplittersUsers,
  updateSplittersUserPermissions,
} from '@/features/access/api/firestoreUsers'
import type {
  SplittersPermissionSet,
  SplittersUserProfile,
} from '@/features/access/model/access.types'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { AccessDeniedState } from '@/features/access/ui/AccessDeniedState'
import { LoadingState } from '@/shared/ui/states/LoadingState'

const usersQueryKey = ['splitters-users-firestore'] as const

function PermissionToggle({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  )
}

function UserPermissionRow({
  user,
  isCurrentUser,
  onSave,
  pending,
}: {
  user: SplittersUserProfile
  isCurrentUser: boolean
  onSave: (payload: { uid: string; permissions: SplittersPermissionSet; isActive: boolean }) => void
  pending: boolean
}) {
  const basePermissions = user.permissions

  return (
    <tr className="border-b border-neutral-100 align-top">
      <td className="px-3 py-3 text-sm text-neutral-900">
        <p className="font-medium">{user.displayName || '-'}</p>
        <p className="text-xs text-neutral-500">{user.email}</p>
      </td>
      <td className="px-3 py-3 text-sm text-neutral-700">
        {user.lastLoginAt ? user.lastLoginAt.toLocaleString('pt-BR') : '-'}
      </td>
      <td className="px-3 py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <PermissionToggle
            label="Ver splitters"
            checked={basePermissions.canViewSplitters}
            disabled={pending}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: user.isActive,
                permissions: { ...basePermissions, canViewSplitters: value },
              })
            }
          />
          <PermissionToggle
            label="Ver massivas"
            checked={basePermissions.canViewMassiva}
            disabled={pending}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: user.isActive,
                permissions: {
                  ...basePermissions,
                  canViewMassiva: value,
                  canOpenMassiva: value ? basePermissions.canOpenMassiva : false,
                },
              })
            }
          />
          <PermissionToggle
            label="Abrir massiva"
            checked={basePermissions.canOpenMassiva}
            disabled={pending || !basePermissions.canViewMassiva}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: user.isActive,
                permissions: { ...basePermissions, canOpenMassiva: value },
              })
            }
          />
          <PermissionToggle
            label="Ver inteligência"
            checked={basePermissions.canViewIntelligence}
            disabled={pending}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: user.isActive,
                permissions: { ...basePermissions, canViewIntelligence: value },
              })
            }
          />
          <PermissionToggle
            label="Administrador"
            checked={basePermissions.isAdmin}
            disabled={pending || isCurrentUser}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: user.isActive,
                permissions: { ...basePermissions, isAdmin: value },
              })
            }
          />
          <PermissionToggle
            label="Usuário ativo"
            checked={user.isActive}
            disabled={pending || isCurrentUser}
            onChange={(value) =>
              onSave({
                uid: user.uid,
                isActive: value,
                permissions: basePermissions,
              })
            }
          />
        </div>
      </td>
    </tr>
  )
}

export function UsersManagementPage() {
  const profile = useAccessAuthStore((s) => s.profile)
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))
  const queryClient = useQueryClient()

  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: listSplittersUsers,
    enabled: isAdmin,
  })

  const updateMutation = useMutation({
    mutationFn: updateSplittersUserPermissions,
    onSuccess: async () => {
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

  if (usersQuery.isLoading) {
    return <LoadingState label="Carregando usuários do Firestore..." />
  }

  if (usersQuery.isError) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        Falha ao carregar usuários: {usersQuery.error instanceof Error ? usersQuery.error.message : 'erro inesperado'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-4">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Administração</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">Gestão de usuários</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Usuários autenticados no Splitters com permissões por módulo (visualização e abertura de massivas).
        </p>
      </header>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left">
            <thead className="bg-neutral-50">
              <tr className="text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-3 py-2.5">Usuário</th>
                <th className="px-3 py-2.5">Último login</th>
                <th className="px-3 py-2.5">Permissões</th>
              </tr>
            </thead>
            <tbody>
              {sortedUsers.map((user) => (
                <UserPermissionRow
                  key={user.uid}
                  user={user}
                  isCurrentUser={profile?.uid === user.uid}
                  pending={updateMutation.isPending}
                  onSave={(payload) => updateMutation.mutate(payload)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
