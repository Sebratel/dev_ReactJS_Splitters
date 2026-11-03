import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'

const calls: string[] = []

const bffRequest = vi.fn<(input: { path: string; body?: unknown }) => Promise<unknown>>()
const registerHistory = vi.fn<(context: unknown, payload: unknown) => Promise<void>>()
const closeTicket = vi.fn<(input: unknown) => Promise<unknown>>()
const registerAffectedCopy = vi.fn<(input: unknown) => Promise<void>>()
let mapeaveis: unknown[] = []

vi.mock('@/shared/api/bffClient', () => ({
  bffClient: { request: (input: { path: string; body?: unknown }) => bffRequest(input) },
}))
vi.mock('@/features/massiva/api/registerOpenedMassivaHistoryInLocalDb', () => ({
  registerOpenedMassivaHistoryInLocalDb: (context: unknown, payload: unknown) =>
    registerHistory(context, payload),
}))
vi.mock('@/features/massiva/api/registerMassivaAffectedClientsInLocalDb', () => ({
  registerMassivaAffectedClientsInLocalDb: (input: unknown) => registerAffectedCopy(input),
}))
vi.mock('@/features/massiva/api/closeMassivaTicket', () => ({
  closeMassivaTicket: (input: unknown) => closeTicket(input),
}))
vi.mock('@/features/massiva/api/openInfraSolicitation', () => ({
  openInfraSolicitation: vi.fn(),
}))
vi.mock('@/features/massiva/lib/buildMassivaOpenRequestBody', () => ({
  buildMassivaOpenRequestBody: (_context: unknown, req: { authenticationAccessPointCode: string }) => ({
    ap: req.authenticationAccessPointCode,
  }),
}))
vi.mock('@/features/massiva/lib/buildMassivaAfetadosRequestBody', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/massiva/lib/buildMassivaAfetadosRequestBody')>()
  return {
    ...original,
    collectMapeableAfetadosClientes: () => mapeaveis,
    buildMassivaAfetadosRequestBody: () => ({ usuarioAfetadoEntities: [] }),
  }
})
vi.mock('@/shared/config/env', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/shared/config/env')>()
  return { ...original, env: { ...original.env, massivaClosePath: '/close' } }
})

const { openMassivaFromContext } = await import('@/features/massiva/api/openMassivaFromContext')
const { MassivaOpenAggregateError } = await import('@/features/massiva/model/massivaOpenMutation')

function makeContext(accessPoints: string[]): MassivaOpenFinalContext {
  return {
    massivaOpenPath: '/open',
    massivaAfetadosPath: '/afetados',
    idempotencyKey: 'tentativa-1',
    plan: {
      requests: accessPoints.map((ap) => ({
        authenticationAccessPointCode: ap,
        assignmentTitle: `Massiva ${ap}`,
      })),
    },
    basis: { collectedClientes: [], topology: { routes: [] } },
  } as unknown as MassivaOpenFinalContext
}

describe('openMassivaFromContext — gravação antecipada do histórico', () => {
  beforeEach(() => {
    calls.length = 0
    mapeaveis = [{}]
    bffRequest.mockReset()
    registerHistory.mockReset()
    closeTicket.mockReset()
    registerAffectedCopy.mockReset()

    registerHistory.mockImplementation(async () => {
      calls.push('history')
    })
    registerAffectedCopy.mockResolvedValue(undefined)
    closeTicket.mockImplementation(async () => {
      calls.push('close')
    })
    bffRequest.mockImplementation(async ({ path, body }) => {
      if (path === '/open') {
        const ap = (body as { ap: string }).ap
        if (ap.startsWith('FALHA')) throw new Error('Elleven indisponível')
        calls.push(`open:${ap}`)
        return { success: true, protocol: ap === 'AP-1' ? 1001 : 1002, assignmentId: ap === 'AP-1' ? 2001 : 2002 }
      }
      calls.push('afetados')
      return { success: true }
    })
  })

  it('grava o histórico logo após abrir cada AP, antes de enviar os afetados', async () => {
    await openMassivaFromContext(makeContext(['AP-1', 'AP-2']))

    expect(calls.slice(0, 5)).toEqual(['open:AP-1', 'history', 'open:AP-2', 'history', 'afetados'])
    const early = registerHistory.mock.calls[0]?.[1] as { results: Array<{ protocol: number }> }
    expect(early.results).toHaveLength(1)
    expect(early.results[0]?.protocol).toBe(1001)
  })

  it('mantém a gravação final com todos os APs depois da antecipada', async () => {
    await openMassivaFromContext(makeContext(['AP-1', 'AP-2']))

    const last = registerHistory.mock.calls[registerHistory.mock.calls.length - 1]?.[1] as {
      results: Array<{ protocol: number }>
      afetadosPostedCount?: number
    }
    expect(last.results.map((r) => r.protocol)).toEqual([1001, 1002])
    expect(last.afetadosPostedCount).toBe(0)
  })

  it('falha na gravação antecipada não derruba a abertura e a final tenta de novo', async () => {
    registerHistory.mockRejectedValueOnce(new Error('MySQL fora'))
    registerHistory.mockRejectedValueOnce(new Error('MySQL fora'))

    const result = await openMassivaFromContext(makeContext(['AP-1', 'AP-2']))

    expect(result.results.map((r) => r.protocol)).toEqual([1001, 1002])
    // 2 antecipadas (falharam) + 1 final (passou)
    expect(registerHistory).toHaveBeenCalledTimes(3)
    expect(result.followUpWarning ?? '').toBe('')
  })

  it('falha parcial entre APs: o AP que abriu já fica no histórico', async () => {
    const promise = openMassivaFromContext(makeContext(['AP-1', 'FALHA-2']))

    await expect(promise).rejects.toBeInstanceOf(MassivaOpenAggregateError)
    expect(registerHistory).toHaveBeenCalledTimes(1)
    const early = registerHistory.mock.calls[0]?.[1] as { results: Array<{ protocol: number }> }
    expect(early.results[0]?.protocol).toBe(1001)
    expect(calls).not.toContain('afetados')
  })

  it('sem clientes mapeáveis: grava como aberta antes de encerrar e como encerrada depois', async () => {
    mapeaveis = []

    const result = await openMassivaFromContext(makeContext(['AP-1']))

    expect(calls).toEqual(['open:AP-1', 'history', 'close', 'history'])
    const early = registerHistory.mock.calls[0]?.[1] as { autoClosedWithoutClients?: boolean }
    const final = registerHistory.mock.calls[1]?.[1] as { autoClosedWithoutClients?: boolean }
    expect(early.autoClosedWithoutClients).not.toBe(true)
    expect(final.autoClosedWithoutClients).toBe(true)
    expect(result.autoClosedWithoutClients).toBe(true)
  })

  it('sem clientes mapeáveis e encerramento falhando: o protocolo continua no histórico como aberto', async () => {
    mapeaveis = []
    closeTicket.mockRejectedValueOnce(new Error('Elleven recusou o encerramento'))

    await expect(openMassivaFromContext(makeContext(['AP-1']))).rejects.toThrow(/encerramento automático/)

    expect(registerHistory).toHaveBeenCalledTimes(1)
    const early = registerHistory.mock.calls[0]?.[1] as { autoClosedWithoutClients?: boolean }
    expect(early.autoClosedWithoutClients).not.toBe(true)
  })
})
