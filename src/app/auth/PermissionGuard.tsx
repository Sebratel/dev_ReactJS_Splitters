import { type ReactNode } from 'react'
import { isFirebaseAuthConfigured } from '@/shared/config/env'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { AccessDeniedState } from '@/features/access/ui/AccessDeniedState'
import type { SplittersPermissionSet } from '@/features/access/model/access.types'

type PermissionGuardProps = {
  permission: keyof SplittersPermissionSet
  description: string
  /** Se true, administradores sempre passam, mesmo sem a permissão específica. */
  allowAdmin?: boolean
  children: ReactNode
}

export function PermissionGuard({
  permission,
  description,
  allowAdmin = false,
  children,
}: PermissionGuardProps) {
  const hasPermission = useAccessAuthStore((s) => s.hasPermission(permission))
  const isAdmin = useAccessAuthStore((s) => s.hasPermission('isAdmin'))

  if (!isFirebaseAuthConfigured()) {
    return <>{children}</>
  }

  if (hasPermission || (allowAdmin && isAdmin)) {
    return <>{children}</>
  }

  return <AccessDeniedState description={description} />
}
