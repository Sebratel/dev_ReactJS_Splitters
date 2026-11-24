import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (...args: unknown[]) => fetchMock(...args),
}))

import { fetchMassivaHistoryListFromLocalDb } from '@/features/massiva/api/fetchMassivaHistoryListFromLocalDb'

function respond(rows: Record<string, unknown>[]) {
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ success: true, data: rows }),
  })
}

describe('fetchMassivaHistoryListFromLocalDb — origem da linha (source)', () => {
  beforeEach(() => fetchMock.mockReset())

  it("lê source 'conferencia-elleven' das linhas recuperadas", async () => {
    respond([{ id: 1, protocol: 1886908, assignmentId: 2322444, status: 'aberta', source: 'conferencia-elleven' }])
    const [row] = await fetchMassivaHistoryListFromLocalDb({})
    expect(row?.source).toBe('conferencia-elleven')
  })

  it('lê source das linhas gravadas pela própria plataforma', async () => {
    respond([{ id: 2, protocol: 1, status: 'encerrada', source: ' nexaview-local ' }])
    const [row] = await fetchMassivaHistoryListFromLocalDb({})
    expect(row?.source).toBe('nexaview-local')
  })

  it('resposta antiga sem o campo (ou vazio) vira null, sem quebrar o resto', async () => {
    respond([
      { id: 3, protocol: 2, status: 'aberta', operatorEmail: 'op@x.com' },
      { id: 4, protocol: 3, status: 'aberta', source: '   ' },
    ])
    const rows = await fetchMassivaHistoryListFromLocalDb({})
    expect(rows[0]?.source).toBeNull()
    expect(rows[1]?.source).toBeNull()
    expect(rows[0]?.operatorEmail).toBe('op@x.com')
  })

  it('linha parcial da conferência (operador e afetados em branco) é lida com valores seguros', async () => {
    respond([{ id: 5, protocol: 1886908, status: 'aberta', source: 'conferencia-elleven', operatorEmail: null, affectedClients: null }])
    const [row] = await fetchMassivaHistoryListFromLocalDb({})
    expect(row?.operatorEmail).toBe('')
    expect(row?.affectedClients).toBe(0)
  })
})
