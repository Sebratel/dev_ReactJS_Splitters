import { afterEach, describe, expect, it, vi } from 'vitest'

const fetchWithSessionAuth = vi.fn()
vi.mock('@/shared/api/fetchWithSessionAuth', () => ({
  fetchWithSessionAuth: (...a: unknown[]) => fetchWithSessionAuth(...a),
}))

import { registerMassivaAffectedClientsInLocalDb } from '@/features/massiva/api/registerMassivaAffectedClientsInLocalDb'

const input = {
  protocol: 1888,
  assignmentId: 77,
  entities: [{ pppoe: 'ana', contractId: 10 }] as never,
}

const resposta = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body })

describe('registerMassivaAffectedClientsInLocalDb', () => {
  afterEach(() => fetchWithSessionAuth.mockReset())

  it('lista vazia não chama o servidor', async () => {
    await registerMassivaAffectedClientsInLocalDb({ ...input, entities: [] })
    expect(fetchWithSessionAuth).not.toHaveBeenCalled()
  })

  it('grava com sucesso quando o servidor insere linhas', async () => {
    fetchWithSessionAuth.mockResolvedValue(resposta({ success: true, data: { inserted: 1 } }))
    await expect(registerMassivaAffectedClientsInLocalDb(input)).resolves.toBeUndefined()
  })

  it('falha quando o servidor responde success mas não gravou nada (ex.: histórico não encontrado)', async () => {
    fetchWithSessionAuth.mockResolvedValue(resposta({ success: true, data: { inserted: 0, reason: 'not-found' } }))
    await expect(registerMassivaAffectedClientsInLocalDb(input)).rejects.toThrow(/not-found/)
  })

  it('falha quando a tabela não existe, sem motivo informado usa texto genérico', async () => {
    fetchWithSessionAuth.mockResolvedValue(resposta({ success: true, data: {} }))
    await expect(registerMassivaAffectedClientsInLocalDb(input)).rejects.toThrow(/nenhuma linha gravada/)
  })

  it('falha com status HTTP de erro', async () => {
    fetchWithSessionAuth.mockResolvedValue(resposta({}, false, 413))
    await expect(registerMassivaAffectedClientsInLocalDb(input)).rejects.toThrow(/413/)
  })

  it('falha com resposta sem success', async () => {
    fetchWithSessionAuth.mockResolvedValue(resposta({ success: false }))
    await expect(registerMassivaAffectedClientsInLocalDb(input)).rejects.toThrow(/inesperada/)
  })
})
