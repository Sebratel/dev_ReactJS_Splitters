export type SplittersPermissionSet = {
  canViewSplitters: boolean
  canViewMassiva: boolean
  canOpenMassiva: boolean
  canViewIntelligence: boolean
  canUsePlanningAssistant: boolean
  canViewRedistribution: boolean
  /** Ver o módulo de GMUD (Gestão de Mudança de Rede). Liberado individualmente pelo admin. */
  canViewGmud: boolean
  /** Aprovar/negar GMUD no Comitê (depende de ver GMUD). Liberado individualmente pelo admin. */
  canApproveGmud: boolean
  isAdmin: boolean
}

export type SplittersUserProfile = {
  uid: string
  email: string
  displayName: string
  /** URL da foto de perfil (ex.: Google); preenchido no login quando disponível. */
  photoURL: string | null
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
  canUsePlanningAssistant: false,
  canViewRedistribution: false,
  canViewGmud: false,
  canApproveGmud: false,
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
