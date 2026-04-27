import { type ReactNode } from 'react'
import { isFirebaseAuthConfigured } from '@/shared/config/env'
import { useAccessAuthStore } from '@/features/access/store/accessAuthStore'
import { AccessDeniedState } from '@/features/access/ui/AccessDeniedState'
import type { SplittersPermissionSet } from '@/features/access/model/access.types'

type PermissionGuardProps = {
  permission: keyof SplittersPermissionSet
  description: string
  children: ReactNode
}

export function PermissionGuard({ permission, description, children }: PermissionGuardProps) {
  const hasPermission = useAccessAuthStore((s) => s.hasPermission(permission))

  if (!isFirebaseAuthConfigured()) {
    return <>{children}</>
  }

  if (!hasPermission) {
    return <AccessDeniedState description={description} />
  }

  return <>{children}</>
}
