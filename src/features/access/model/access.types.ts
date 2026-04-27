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

export const defaultSplittersPermissions: SplittersPermissionSet = {
  canViewSplitters: true,
  canViewMassiva: false,
  canOpenMassiva: false,
  canViewIntelligence: true,
  isAdmin: false,
}
