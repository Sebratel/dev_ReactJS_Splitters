import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/session/store/sessionStore', () => ({
  useSessionStore: { getState: vi.fn(() => ({ sessionToken: null, setAuthStatus: vi.fn() })) },
}))

vi.mock('@/app/auth/oidcAccessToken', () => ({
  getOidcAccessToken: vi.fn(() => null),
}))

describe('bffClient', () => {
  it('exporta cliente com request', async () => {
    const { bffClient } = await import('@/shared/api/bffClient')
    expect(typeof bffClient.request).toBe('function')
  })
})
