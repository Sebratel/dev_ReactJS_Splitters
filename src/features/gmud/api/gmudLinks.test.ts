import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchWithSessionAuth = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>()

vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (url: string, init?: RequestInit) => fetchWithSessionAuth(url, init),
}))

const { linkMassivasToGmud } = await import('@/features/gmud/api/gmudLinks')

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('linkMassivasToGmud (seleção múltipla)', () => {
  beforeEach(() => {
    fetchWithSessionAuth.mockReset()
  })

  it('vincula todas em sequência, uma requisição por massiva', async () => {
    fetchWithSessionAuth.mockImplementation(async () => json({ success: true, data: {} }))

    const result = await linkMassivasToGmud(1846364, [111, 222, 333])

    expect(result).toEqual({ linked: [111, 222, 333], failed: [] })
    expect(fetchWithSessionAuth).toHaveBeenCalledTimes(3)
    const bodies = fetchWithSessionAuth.mock.calls.map(([, init]) => JSON.parse(String(init?.body)))
    expect(bodies).toEqual([
      { gmudProtocol: 1846364, massivaProtocol: 111 },
      { gmudProtocol: 1846364, massivaProtocol: 222 },
      { gmudProtocol: 1846364, massivaProtocol: 333 },
    ])
  })

  it('não aborta no primeiro erro e devolve o motivo de cada falha', async () => {
    fetchWithSessionAuth.mockImplementation(async (_url, init) => {
      const { massivaProtocol } = JSON.parse(String(init?.body))
      return massivaProtocol === 222
        ? json({ success: false, message: 'GMUD não aprovada' }, 409)
        : json({ success: true, data: {} })
    })

    const result = await linkMassivasToGmud(1846364, [111, 222, 333])

    expect(result.linked).toEqual([111, 333])
    expect(result.failed).toEqual([{ massivaProtocol: 222, message: 'GMUD não aprovada' }])
  })

  it('lista vazia não faz requisição', async () => {
    const result = await linkMassivasToGmud(1846364, [])
    expect(result).toEqual({ linked: [], failed: [] })
    expect(fetchWithSessionAuth).not.toHaveBeenCalled()
  })
})
