export type AuthStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'invalid-session'

/**
 * Contrato completo para paridade com `AppSessionUser` do Flutter.
 */
export type SessionUser = {
  email: string
  name: string | null
  personId: number | null
  roles: string[]
  permissions: string[]
  isAdmin: boolean
  canAccessMassiva: boolean
  canOpenMassiva: boolean
}

export const defaultLocalSessionUser: SessionUser = {
  email: 'dev@local',
  name: 'Local Dev',
  personId: 629,
  roles: ['local_massiva'],
  permissions: ['massiva_view', 'massiva_open'],
  isAdmin: true,
  canAccessMassiva: true,
  canOpenMassiva: true,
}

