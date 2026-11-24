import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMock = vi.fn()
vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (...args: unknown[]) => fetchMock(...args),
}))

import { finalizeMassivaOnServer } from '@/features/massiva/api/finalizeMassivaOnServer'

const input = { mode: 'encerrar', protocol: 10, assignmentId: 20, description: 'resolvido' } as const

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body }
}

describe('finalizeMassivaOnServer', () => {
  beforeEach(() => fetchMock.mockReset())

  it('sucesso: handled true e repassa o aviso do histórico local', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true, data: { ok: true, localHistoryWarning: 'sem registro' } }))
    await expect(finalizeMassivaOnServer(input)).resolves.toEqual({ handled: true, localHistoryWarning: 'sem registro' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/massiva/finalize')
    expect(JSON.parse(String((init as RequestInit).body))).toMatchObject({ mode: 'encerrar', protocol: 10, assignmentId: 20 })
  })

  it('503 gateway_not_configured: handled false (cai no fluxo antigo)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { success: false, code: 'gateway_not_configured', message: 'x' }))
    await expect(finalizeMassivaOnServer(input)).resolves.toEqual({ handled: false })
  })

  it('502 (Elleven recusou): lança com a mensagem, sem fallback', async () => {
    fetchMock.mockResolvedValue(jsonResponse(502, { success: false, message: 'Elleven/gateway recusou (HTTP 500).' }))
    await expect(finalizeMassivaOnServer(input)).rejects.toThrow('Elleven/gateway recusou')
  })

  it('503 sem o código esperado também lança', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, { success: false, message: 'indisponível' }))
    await expect(finalizeMassivaOnServer(input)).rejects.toThrow('indisponível')
  })
})
