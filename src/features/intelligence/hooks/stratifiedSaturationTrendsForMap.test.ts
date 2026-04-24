import { describe, expect, it } from 'vitest'
import type { IntelligenceTrendRow, TrendLabel } from '@/features/intelligence/hooks/useNetworkIntelligenceData'
import { stratifiedSaturationTrendsForMap } from '@/features/intelligence/hooks/useNetworkIntelligenceData'

function row(
  code: string,
  usage: number,
  label: TrendLabel = 'Estavel',
): IntelligenceTrendRow {
  return {
    splitterCode: code,
    splitterTitle: '',
    latitude: null,
    longitude: null,
    label,
    currentUsagePercent: usage,
    delta7d: 0,
    delta30d: 0,
    capturedAt: new Date(),
  }
}

describe('stratifiedSaturationTrendsForMap', () => {
  it('intercala faixas quando todas existem (até o limite)', () => {
    const trends = [
      row('c1', 96),
      row('c2', 97),
      row('a1', 80),
      row('a2', 85),
      row('o1', 50),
      row('o2', 40),
    ]
    const out = stratifiedSaturationTrendsForMap(trends, 6)
    // Dentro de cada faixa, ordem é por maior uso (crit: c2 antes de c1; alert: a2 antes de a1).
    expect(out.map((r) => r.splitterCode)).toEqual(['c2', 'a2', 'o1', 'c1', 'a1', 'o2'])
  })

  it('completa pelo maior uso quando uma faixa esgota', () => {
    const trends = [row('c1', 99), row('c2', 98), row('c3', 97), row('a1', 80)]
    const out = stratifiedSaturationTrendsForMap(trends, 4)
    expect(out.map((r) => r.splitterCode)).toEqual(['c1', 'a1', 'c2', 'c3'])
  })

  it('lista vazia retorna vazio', () => {
    expect(stratifiedSaturationTrendsForMap([], 80)).toEqual([])
  })
})
