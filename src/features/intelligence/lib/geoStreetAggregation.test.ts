import { describe, expect, it } from 'vitest'
import { buildTopStreetsByNormalizedStreet } from '@/features/intelligence/lib/geoStreetAggregation'

describe('buildTopStreetsByNormalizedStreet', () => {
  it('agrupa variantes da mesma rua (Av. vs Avenida)', () => {
    const top = buildTopStreetsByNormalizedStreet([
      { street: 'Av. Luiz Pasteur', currentUsagePercent: 96 },
      { street: 'Avenida Luiz Pasteur', currentUsagePercent: 50 },
      { street: 'Av Luiz Pasteur', currentUsagePercent: 97 },
    ])

    expect(top).toHaveLength(1)
    expect(top[0]?.splitters).toBe(3)
    expect(top[0]?.criticalSplitters).toBe(2)
    expect(top[0]?.nome).toBe('Avenida Luiz Pasteur')
  })

  it('ordena por críticos e depois por total de splitters', () => {
    const top = buildTopStreetsByNormalizedStreet([
      { street: 'Rua A', currentUsagePercent: 96 },
      { street: 'Rua B', currentUsagePercent: 50 },
      { street: 'Rua B', currentUsagePercent: 97 },
      { street: 'Rua C', currentUsagePercent: 98 },
      { street: 'Rua C', currentUsagePercent: 99 },
      { street: 'Rua C', currentUsagePercent: 30 },
    ])

    expect(top[0]?.nome).toBe('Rua C')
    expect(top[0]?.criticalSplitters).toBe(2)
    expect(top[0]?.splitters).toBe(3)
    expect(top[1]?.nome).toBe('Rua B')
    expect(top[1]?.criticalSplitters).toBe(1)
    expect(top[1]?.splitters).toBe(2)
  })

  it('ignora rua vazia ou que não normaliza', () => {
    expect(
      buildTopStreetsByNormalizedStreet([
        { street: '', currentUsagePercent: 99 },
        { street: '   ', currentUsagePercent: 99 },
      ]),
    ).toHaveLength(0)
  })
})
