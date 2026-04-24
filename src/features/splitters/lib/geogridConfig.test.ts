import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isLocalMock } = vi.hoisted(() => ({
  isLocalMock: vi.fn(),
}))

vi.mock('@/shared/config/env', () => ({
  env: {
    localBffUrl: 'http://localhost:3001',
    geogridBaseUrl: 'https://geo.example',
    geogridApiKey: 'k',
  },
  isLocalDevHostname: () => isLocalMock(),
}))

describe('isGeogridConfigured', () => {
  beforeEach(() => {
    isLocalMock.mockReturnValue(false)
  })

  it('true quando GeoGrid tem base e key e não é host local', async () => {
    vi.resetModules()
    const { isGeogridConfigured } = await import(
      '@/features/splitters/lib/geogridConfig'
    )
    expect(isGeogridConfigured()).toBe(true)
  })

  it('true em host local quando localBffUrl não vazio', async () => {
    vi.resetModules()
    isLocalMock.mockReturnValue(true)
    const { isGeogridConfigured } = await import(
      '@/features/splitters/lib/geogridConfig'
    )
    expect(isGeogridConfigured()).toBe(true)
  })
})
