import { describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/api/bffClient', () => ({
  bffClient: {
    request: vi.fn(),
  },
}))

describe('clientes api bff reexports', () => {
  it('expõe path e fetch da listagem global', async () => {
    const { SPLITTER_CONNECTIONS_PATH, fetchConnectionsList } = await import(
      '@/features/clientes/api/bff'
    )
    expect(SPLITTER_CONNECTIONS_PATH).toBe('/api/v1/splitters/listarConnections')
    expect(typeof fetchConnectionsList).toBe('function')
  })
})
