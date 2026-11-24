import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchWithSessionAuth = vi.fn()
vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (...a: unknown[]) => fetchWithSessionAuth(...a),
}))

import { parseSkippedContractIds, recordExcludedClients } from '@/features/massiva/api/recordExcludedClients'

describe('parseSkippedContractIds', () => {
  it('lê os contratos que o gateway deixou de fora', () => {
    expect(parseSkippedContractIds({ success: true, data: { skippedContractIds: [3, '5', 0, -1, 'x'] } })).toEqual([3, 5])
  })
  it('ausente ou formato inesperado vira lista vazia', () => {
    expect(parseSkippedContractIds(null)).toEqual([])
    expect(parseSkippedContractIds({ data: {} })).toEqual([])
    expect(parseSkippedContractIds({ data: { skippedContractIds: 'x' } })).toEqual([])
  })
})

describe('recordExcludedClients', () => {
  afterEach(() => fetchWithSessionAuth.mockReset())

  const input = {
    protocol: 1888, assignmentId: 77, reason: 'queda', finishDate: '2026-11-20T18:00:00',
    clients: [{ contractId: 10, pppoe: 'ana', corporate: false, blockedByProtocol: 1700, blockedByType: 'massiva' as const }],
  }

  it('envia o registro ao BFF', async () => {
    fetchWithSessionAuth.mockResolvedValue({ ok: true })
    await recordExcludedClients(input)
    expect(fetchWithSessionAuth).toHaveBeenCalledTimes(1)
    const [url, init] = fetchWithSessionAuth.mock.calls[0] as [string, { body: string }]
    expect(url).toMatch(/\/api\/massiva\/clientes-excluidos$/)
    expect(JSON.parse(init.body).clients[0].blockedByProtocol).toBe(1700)
  })

  it('sem clientes não chama nada', async () => {
    await recordExcludedClients({ ...input, clients: [] })
    expect(fetchWithSessionAuth).not.toHaveBeenCalled()
  })

  it('falha de rede nunca lança (a abertura já aconteceu)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    fetchWithSessionAuth.mockRejectedValue(new Error('BFF fora do ar'))
    await expect(recordExcludedClients(input)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})
