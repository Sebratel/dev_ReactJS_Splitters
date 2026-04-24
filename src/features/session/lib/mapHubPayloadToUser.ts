import type { HubSessionPayload } from '@/features/session/model/hubSession.types'
import type { SessionUser } from '@/features/session/model/session.types'

/**
 * Mapeia o payload bruto do Hub (/auth/session) para o SessionUser do app.
 * Paridade estrita com AppSessionUser.fromHubSession do Flutter.
 */
export function mapHubPayloadToUser(payload: HubSessionPayload): SessionUser {
  const email = (payload.email ?? '').trim().toLowerCase()
  const name = payload.name?.trim() ?? null
  const isAdmin = payload.isAdmin === true

  // Normalização de permissões (paridade com logic em AppSessionUser._extractValues)
  const permissions = normalizeList(payload.permissions)
  const roles = normalizeList([payload.profile, payload.team])

  // Identificadores de permissão (paridade com constants do Flutter)
  const MASSIVA_VIEW = 'massiva_view'
  const MASSIVA_OPEN = 'massiva_open'

  // Cálculos de acesso derivado (paridade estrita com Dart)
  const canAccessMassiva =
    isAdmin ||
    permissions.includes(MASSIVA_VIEW) ||
    permissions.includes(MASSIVA_OPEN) ||
    permissions.includes('massiva_admin')

  const canOpenMassiva =
    isAdmin ||
    permissions.includes(MASSIVA_OPEN) ||
    permissions.includes('massiva_admin')

  /**
   * FALLBACK PARA personId:
   * No Flutter (fromHubSession), o personId é nulo. 
   * Aqui tentamos extrair caso o Hub passe chaves comuns de legado/compatibilidade.
   */
  const personId = extractPersonId(payload)

  return {
    email,
    name,
    personId,
    roles,
    permissions,
    isAdmin,
    canAccessMassiva,
    canOpenMassiva,
  }
}

/**
 * Normaliza valores para lista de strings padronizada (trim + lowercase).
 */
function normalizeList(value: unknown): string[] {
  if (!value) return []
  
  const raw = Array.isArray(value) ? value : [value]
  const result: string[] = []

  raw.forEach((item) => {
    if (typeof item === 'string' && item.trim().length > 0) {
      // No Flutter, algumas permissões podem vir separadas por vírgula em uma única string
      item.split(',').forEach(part => {
        const p = part.trim().toLowerCase()
        if (p) result.push(p)
      })
    }
  })

  return [...new Set(result)] // Remove duplicatas
}

/**
 * Helper para extração de personId com fallbacks de nomes de campos comuns.
 */
function extractPersonId(payload: HubSessionPayload): number | null {
  const keys = [
    'personId',
    'person_id',
    'employeeId',
    'employee_id',
    'colaboradorId',
    'colaborador_id',
    'id',
  ]

  for (const key of keys) {
    const val = ((payload as unknown) as Record<string, unknown>)[key]
    if (typeof val === 'number' && val > 0) return val
    if (typeof val === 'string') {
      const parsed = parseInt(val, 10)
      if (!isNaN(parsed) && parsed > 0) return parsed
    }
  }

  return null
}



