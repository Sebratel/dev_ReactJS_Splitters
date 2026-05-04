import { describe, expect, it } from 'vitest'
import {
  buildDashboardHeroChips,
  buildDashboardStatusLine,
  formatRefreshChipShort,
  interpretTrendDelta,
  formatNetworkStatsRefreshNote,
} from '@/features/dashboard/lib/dashboardNarrative'

describe('dashboardNarrative', () => {
  it('interpretTrendDelta devolve mensagens estáveis e direccionais', () => {
    expect(interpretTrendDelta('occupiedPorts', null)).toBeUndefined()
    expect(interpretTrendDelta('occupiedPorts', 0)).toMatch(/Estável/)
    expect(interpretTrendDelta('occupiedPorts', 2.5)).toMatch(/Mais portas ocupadas/)
    expect(interpretTrendDelta('massivaOpen', -1)).toMatch(/Menos massivas abertas/)
  })

  it('buildDashboardStatusLine prioriza incidentes e inclui capacidade quando existe', () => {
    expect(
      buildDashboardStatusLine({
        isLoadingStats: true,
        massivaKpisPending: true,
        openMassivas: 0,
        affectedClients: 0,
        networkCapacityPercent: null,
      }),
    ).toMatch(/sincronizar/i)

    expect(
      buildDashboardStatusLine({
        isLoadingStats: false,
        massivaKpisPending: false,
        openMassivas: 2,
        affectedClients: 120,
        networkCapacityPercent: 45.2,
      }),
    ).toMatch(/2 massivas abertas/)
    expect(
      buildDashboardStatusLine({
        isLoadingStats: false,
        massivaKpisPending: false,
        openMassivas: 2,
        affectedClients: 120,
        networkCapacityPercent: 45.2,
      }),
    ).toMatch(/45,2%/)

    expect(
      buildDashboardStatusLine({
        isLoadingStats: false,
        massivaKpisPending: false,
        openMassivas: 0,
        affectedClients: 0,
        networkCapacityPercent: null,
      }),
    ).toMatch(/Nenhuma massiva aberta/)
  })

  it('formatNetworkStatsRefreshNote devolve null ou texto pt-BR', () => {
    expect(formatNetworkStatsRefreshNote(undefined)).toBeNull()
    expect(formatNetworkStatsRefreshNote(0)).toBeNull()
    expect(formatNetworkStatsRefreshNote(Date.now())).toMatch(/Dados agregados/)
  })

  it('buildDashboardHeroChips devolve pills por contexto', () => {
    const chips = buildDashboardHeroChips({
      isLoadingStats: false,
      massivaKpisPending: false,
      openMassivas: 1,
      affectedClients: 6,
      networkCapacityPercent: 29.2,
    })
    expect(chips.some((c) => c.accent === 'warn')).toBe(true)
    expect(chips.find((c) => c.id === 'capacity')?.text).toMatch(/29,2%/)
  })

  it('formatRefreshChipShort é compacto', () => {
    expect(formatRefreshChipShort(undefined)).toBeNull()
    expect(formatRefreshChipShort(Date.now())).toMatch(/^Atualizado /)
  })
})
