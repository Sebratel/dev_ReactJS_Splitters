import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MassivaOpenFinalContext } from '@/features/massiva/model/massivaOpenReadiness'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

const fetchConflicts = vi.fn()
vi.mock('@/features/massiva/api/fetchMassivaClientConflicts', () => ({
  fetchMassivaClientConflicts: (...a: unknown[]) => fetchConflicts(...a),
}))

import { excludeClientsInOtherEvents } from '@/features/massiva/api/excludeClientsInOtherEvents'

const cliente = (user: string, contractId: number) =>
  ({ user, contract: { id: contractId } }) as unknown as SplitterCliente

function ctx(extra: Partial<MassivaOpenFinalContext> = {}): MassivaOpenFinalContext {
  return {
    basis: { collectedClientes: [cliente('ana', 10), cliente('beto', 11), cliente('cris', 12)] },
    ...extra,
  } as unknown as MassivaOpenFinalContext
}

describe('excludeClientsInOtherEvents', () => {
  beforeEach(() => {
    fetchConflicts.mockReset()
  })

  it('tira da seleção quem já está em outro evento aberto', async () => {
    fetchConflicts.mockResolvedValue({
      events: [{ origin: 'massiva', protocol: 1888, title: 'x', openedAt: null, finishDate: null, clients: [] }],
      contractIds: [11, 12],
    })
    const r = await excludeClientsInOtherEvents(ctx())
    expect(r.excludedCount).toBe(2)
    expect(r.eventProtocols).toEqual([1888])
    expect(r.context.basis.collectedClientes.map((c) => c.user)).toEqual(['ana'])
  })

  it('sem conflito mantém tudo', async () => {
    fetchConflicts.mockResolvedValue({ events: [], contractIds: [] })
    const input = ctx()
    const r = await excludeClientsInOtherEvents(input)
    expect(r.excludedCount).toBe(0)
    expect(r.context).toBe(input)
  })

  it('se o operador escolheu incluir mesmo assim, nem consulta', async () => {
    const r = await excludeClientsInOtherEvents(ctx({ includeConflictingClients: true }))
    expect(fetchConflicts).not.toHaveBeenCalled()
    expect(r.excludedCount).toBe(0)
  })

  it('falha na consulta nunca bloqueia: segue sem exclusão', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchConflicts.mockRejectedValue(new Error('BFF fora do ar'))
    const input = ctx()
    const r = await excludeClientsInOtherEvents(input)
    expect(r.excludedCount).toBe(0)
    expect(r.context).toBe(input)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('seleção sem cliente mapeável não consulta', async () => {
    const r = await excludeClientsInOtherEvents(
      ctx({ basis: { collectedClientes: [] } as unknown as MassivaOpenFinalContext['basis'] }),
    )
    expect(fetchConflicts).not.toHaveBeenCalled()
    expect(r.excludedCount).toBe(0)
  })
})
