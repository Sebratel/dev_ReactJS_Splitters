export type SplittersPermissionSet = {
  canViewSplitters: boolean
  canViewMassiva: boolean
  canOpenMassiva: boolean
  canViewIntelligence: boolean
  isAdmin: boolean
}

export type SplittersUserProfile = {
  uid: string
  email: string
  displayName: string
  isActive: boolean
  permissions: SplittersPermissionSet
  createdAt: Date | null
  updatedAt: Date | null
  lastLoginAt: Date | null
}

/** Novos utilizadores (após o primeiro admin) entram só com dashboard + listagem de splitters. */
export const defaultSplittersPermissions: SplittersPermissionSet = {
  canViewSplitters: true,
  canViewMassiva: false,
  canOpenMassiva: false,
  canViewIntelligence: false,
  isAdmin: false,
}

export type SplittersAccessRequestStatus = 'pending' | 'approved' | 'rejected'

/** Módulos pedidos na solicitação (o utilizador só vê os que ainda não tem). */
export type SplittersAccessRequestModuleId =
  | 'massiva_view'
  | 'massiva_open'
  | 'intelligence'
  | 'admin'

export type SplittersAccessRequest = {
  id: string
  uid: string
  email: string
  displayName: string
  message: string
  requestedModules: SplittersAccessRequestModuleId[]
  status: SplittersAccessRequestStatus
  createdAt: Date | null
  updatedAt: Date | null
  reviewedAt: Date | null
  reviewedByUid: string | null
  adminNote: string | null
  grantedPermissions: SplittersPermissionSet | null
}
