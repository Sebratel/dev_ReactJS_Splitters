import { describe, expect, it } from 'vitest'
import { buildMassivaRouteCatalogFromRows } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { effectiveMassivaSplittersForRoute } from '@/features/massiva/lib/effectiveMassivaSplittersForRoute'

describe('effectiveMassivaSplittersForRoute', () => {
  it('usa conjunto explícito quando não vazio; senão catálogo', () => {
    const catalog = buildMassivaRouteCatalogFromRows([
      {
        apCode: 'AP1',
        apTitle: 'T',
        oltCode: null,
        oltTitle: null,
        slot: 1,
        port: 2,
        splitterCode: 'S1',
        splitterTitle: 'ST',
      },
    ])
    expect(
      [...effectiveMassivaSplittersForRoute(catalog, 'AP1', 1, 2, undefined)],
    ).toEqual(['S1'])
    expect(
      [
        ...effectiveMassivaSplittersForRoute(
          catalog,
          'AP1',
          1,
          2,
          new Set(['X']),
        ),
      ],
    ).toEqual(['X'])
    expect(
      [
        ...effectiveMassivaSplittersForRoute(
          catalog,
          'AP1',
          1,
          2,
          new Set(),
        ),
      ],
    ).toEqual(['S1'])
  })
})
