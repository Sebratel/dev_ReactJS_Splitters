import { describe, expect, it, vi } from 'vitest'

// parsePermissions vive junto do acesso ao Firestore; o teste só precisa da função pura.
vi.mock('@/shared/config/firebase', () => ({ firestoreDb: {} }))
vi.mock('firebase/firestore', async (importOriginal) => ({ ...(await importOriginal<typeof import('firebase/firestore')>()) }))
import { parsePermissions } from '@/features/access/api/firestoreUsers'
import { defaultSplittersPermissions } from '@/features/access/model/access.types'
import {
  SPLITTERS_PRESET_ROLE_IDS,
  SPLITTERS_ROLE_PRESETS,
  inferSplittersUserRole,
} from '@/features/access/lib/splittersUserRoles'

describe('permissão de abrir GMUD pré-aprovada', () => {
  it('é opt-in: ausente no cadastro conta como "não pode"', () => {
    expect(defaultSplittersPermissions.canOpenGmudPreAprovada).toBe(false)
    expect(parsePermissions({ canViewGmud: true }).canOpenGmudPreAprovada).toBe(false)
    expect(parsePermissions(undefined).canOpenGmudPreAprovada).toBe(false)
  })

  it('o valor gravado é respeitado', () => {
    expect(parsePermissions({ canOpenGmudPreAprovada: true }).canOpenGmudPreAprovada).toBe(true)
  })

  it('só o perfil admin vem com a permissão', () => {
    for (const id of SPLITTERS_PRESET_ROLE_IDS) {
      expect(SPLITTERS_ROLE_PRESETS[id].canOpenGmudPreAprovada).toBe(id === 'admin')
    }
  })

  it('dar a permissão a um operador o torna "personalizado"', () => {
    const operador = { ...SPLITTERS_ROLE_PRESETS.operador, canOpenGmudPreAprovada: true }
    expect(inferSplittersUserRole(operador)).toBe('personalizado')
    expect(inferSplittersUserRole(SPLITTERS_ROLE_PRESETS.operador)).toBe('operador')
  })
})
