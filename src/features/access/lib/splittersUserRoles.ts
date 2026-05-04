import type { SplittersPermissionSet } from '@/features/access/model/access.types'

export type SplittersRoleId = 'admin' | 'operador' | 'leitura' | 'personalizado'

export const SPLITTERS_ROLE_LABEL: Record<SplittersRoleId, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  leitura: 'Leitura',
  personalizado: 'Personalizado',
}

export const SPLITTERS_ROLE_DESCRIPTION: Record<Exclude<SplittersRoleId, 'personalizado'>, string> = {
  admin: 'Acesso total ao sistema e à gestão de usuários.',
  operador: 'Operação completa: splitters, massivas (abrir) e inteligência, sem administração.',
  leitura: 'Visualização de splitters, massivas e inteligência; sem abertura de massiva.',
}

/** Presets canônicos (comparação bit a bit para inferir “personalizado”). */
export const SPLITTERS_ROLE_PRESETS: Record<
  Exclude<SplittersRoleId, 'personalizado'>,
  SplittersPermissionSet
> = {
  admin: {
    canViewSplitters: true,
    canViewMassiva: true,
    canOpenMassiva: true,
    canViewIntelligence: true,
    isAdmin: true,
  },
  operador: {
    canViewSplitters: true,
    canViewMassiva: true,
    canOpenMassiva: true,
    canViewIntelligence: true,
    isAdmin: false,
  },
  leitura: {
    canViewSplitters: true,
    canViewMassiva: true,
    canOpenMassiva: false,
    canViewIntelligence: true,
    isAdmin: false,
  },
}

function permissionsEqual(a: SplittersPermissionSet, b: SplittersPermissionSet): boolean {
  return (
    a.canViewSplitters === b.canViewSplitters &&
    a.canViewMassiva === b.canViewMassiva &&
    a.canOpenMassiva === b.canOpenMassiva &&
    a.canViewIntelligence === b.canViewIntelligence &&
    a.isAdmin === b.isAdmin
  )
}

export function inferSplittersUserRole(permissions: SplittersPermissionSet): SplittersRoleId {
  if (permissionsEqual(permissions, SPLITTERS_ROLE_PRESETS.admin)) return 'admin'
  if (permissionsEqual(permissions, SPLITTERS_ROLE_PRESETS.operador)) return 'operador'
  if (permissionsEqual(permissions, SPLITTERS_ROLE_PRESETS.leitura)) return 'leitura'
  return 'personalizado'
}

export function applySplittersRolePreset(role: Exclude<SplittersRoleId, 'personalizado'>): SplittersPermissionSet {
  return { ...SPLITTERS_ROLE_PRESETS[role] }
}

export type LoginRecency = 'recente' | 'medio' | 'antigo' | 'nunca'

export function loginRecency(lastLoginAt: Date | null): LoginRecency {
  if (lastLoginAt == null || Number.isNaN(lastLoginAt.getTime())) return 'nunca'
  const days = (Date.now() - lastLoginAt.getTime()) / (1000 * 60 * 60 * 24)
  if (days <= 7) return 'recente'
  if (days <= 30) return 'medio'
  return 'antigo'
}

export function userInitials(displayName: string, email: string): string {
  const n = displayName.trim()
  if (n.length > 0) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase().slice(0, 2)
    }
    return n.slice(0, 2).toUpperCase()
  }
  const e = email.trim()
  if (e.length > 0) return e.slice(0, 2).toUpperCase()
  return '?'
}
