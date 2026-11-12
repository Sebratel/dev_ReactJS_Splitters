import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'

const request = vi.fn()
const closeMassivaTicket = vi.fn()
const registerHistory = vi.fn()

vi.mock('@/shared/api/bffClient', () => ({ bffClient: { request: (...a: unknown[]) => request(...a) } }))
vi.mock('@/features/massiva/api/closeMassivaTicket', () => ({
  closeMassivaTicket: (...a: unknown[]) => closeMassivaTicket(...a),
}))
vi.mock('@/features/massiva/api/registerOpenedMassivaHistoryInLocalDb', () => ({
  registerOpenedMassivaHistoryInLocalDb: (...a: unknown[]) => registerHistory(...a),
}))
vi.mock('@/features/massiva/api/registerMassivaAffectedClientsInLocalDb', () => ({
  registerMassivaAffectedClientsInLocalDb: vi.fn(),
}))
vi.mock('@/features/massiva/api/openInfraSolicitation', () => ({ openInfraSolicitation: vi.fn() }))
vi.mock('@/features/splitters/api/fetchSplitterConnectionsFromLocalDb', () => ({
  fetchMassivaConnectionsFromLocalDbByRoutes: vi.fn(async () => []),
}))
vi.mock('@/features/massiva/lib/buildMassivaOpenRequestBody', () => ({
  buildMassivaOpenRequestBody: () => ({}),
}))
vi.mock('@/shared/config/env', () => ({
  env: { massivaClosePath: '/api/v1/finalizar-chamado-via-api' },
}))

import { openMassivaFromContext } from '@/features/massiva/api/openMassivaFromContext'

function semClientesContext(extra: Partial<MassivaOpenFinalContext> = {}): MassivaOpenFinalContext {
  return {
    personId: 1,
    operatorEmail: 'op@test.com',
    operatorName: 'Operador',
    basis: { topology: { routes: [] }, collectedClientes: [] } as unknown as MassivaOpenFinalContext['basis'],
    plan: {
      requests: [{ authenticationAccessPointCode: '34291', assignmentTitle: 'Sistemas Internos - CRM Comercial' }],
    } as unknown as MassivaOpenFinalContext['plan'],
    assignmentDescription: 'teste',
    assignmentFinalDateLocal: '2026-11-12T18:00:00',
    assignmentBeginningDateLocal: null,
    eventIdentifiedAtLocal: null,
    eventIdentifiedBy: 'tecnico',
    massivaOpenPath: '/open',
    massivaAfetadosPath: '/afetados',
    affectedUsersQuantityFlutterParity: 1,
    descriptionAutoSyncEnabled: false,
    ...extra,
  } as MassivaOpenFinalContext
}

describe('openMassivaFromContext sem clientes na seleção', () => {
  beforeEach(() => {
    request.mockReset()
    closeMassivaTicket.mockReset()
    registerHistory.mockReset()
    request.mockResolvedValue({ success: true, protocol: 1888200, assignmentId: 777 })
    closeMassivaTicket.mockResolvedValue(undefined)
    registerHistory.mockResolvedValue(undefined)
  })

  it('massiva de rede sem clientes continua sendo encerrada automaticamente', async () => {
    const result = await openMassivaFromContext(semClientesContext())
    expect(closeMassivaTicket).toHaveBeenCalledTimes(1)
    expect(result.autoClosedWithoutClients).toBe(true)
  })

  it('assunto de sistema não encerra automaticamente e deixa o protocolo aberto', async () => {
    const result = await openMassivaFromContext(
      semClientesContext({ skipAutoCloseWithoutClients: true }),
    )
    expect(closeMassivaTicket).not.toHaveBeenCalled()
    expect(result.autoClosedWithoutClients).not.toBe(true)
    expect(result.followUpWarning).toBeUndefined()
    // só o POST de abertura: nenhum POST de afetados
    expect(request).toHaveBeenCalledTimes(1)
    expect(registerHistory).toHaveBeenCalledTimes(1)
    expect(result.results[0]?.protocol).toBe(1888200)
  })
})
