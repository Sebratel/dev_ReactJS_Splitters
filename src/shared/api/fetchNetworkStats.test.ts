import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/shared/config/env', () => ({
  env: { localBffUrl: 'http://bff.test' },
}))

import { fetchNetworkStats } from '@/shared/api/fetchNetworkStats'

describe('fetchNetworkStats', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mapeia resposta snake_case e camelCase', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          catalog_equipment: 10,
          occupied_ports: 20,
          olt_count: 3,
          equipment_occupancy_green: 1,
          equipment_occupancy_yellow: 2,
          equipment_occupancy_red: 4,
        },
      }),
    } as Response)

    const stats = await fetchNetworkStats()
    expect(stats).toEqual({
      activeSplitters: 10,
      onlineClients: 20,
      oltCount: 3,
      equipmentOccupancy: { green: 1, yellow: 2, red: 4 },
      trends: null,
    })
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('http://bff.test/api/stats')
  })

  it('normaliza valores não numéricos para 0', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          catalog_equipment: Number.NaN,
          occupied_ports: 'x',
        },
      }),
    } as Response)

    const stats = await fetchNetworkStats()
    expect(stats.activeSplitters).toBe(0)
    expect(stats.onlineClients).toBe(0)
    expect(stats.oltCount).toBe(0)
    expect(stats.equipmentOccupancy).toEqual({ green: 0, yellow: 0, red: 0 })
    expect(stats.trends).toBeNull()
  })

  it('mapeia trends quando presentes', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          catalog_equipment: 1,
          occupied_ports: 2,
          olt_count: 3,
          equipment_occupancy_green: 0,
          equipment_occupancy_yellow: 0,
          equipment_occupancy_red: 0,
        },
        trends: {
          occupied_ports_pct: 1.5,
          active_splitters_pct: -2,
          olt_count_pct: 0,
          massiva_open_pct: 10,
          massiva_affected_open_pct: -3.3,
        },
      }),
    } as Response)

    const stats = await fetchNetworkStats()
    expect(stats.trends).toEqual({
      occupiedPortsPct: 1.5,
      activeSplittersPct: -2,
      oltCountPct: 0,
      massivaOpenPct: 10,
      massivaAffectedOpenPct: -3.3,
    })
  })

  it('lança quando HTTP não ok ou success false', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false } as Response)
    await expect(fetchNetworkStats()).rejects.toThrow(
      'Falha ao buscar estatísticas de rede',
    )

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false, error: 'x' }),
    } as Response)
    await expect(fetchNetworkStats()).rejects.toThrow('x')

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: false }),
    } as Response)
    await expect(fetchNetworkStats()).rejects.toThrow(
      'Erro desconhecido nas estatísticas',
    )
  })
})
