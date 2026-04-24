import { describe, expect, it } from 'vitest'
import { buildMassivaRouteCatalogFromRows } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { resolveEffectiveMassivaSplitterCodes } from '@/features/massiva/lib/resolveEffectiveMassivaSplitterCodes'
import type { MassivaLocalPreviewRouteSelection } from '@/features/massiva/model/massivaLocalPreview'

const catalog = buildMassivaRouteCatalogFromRows([
  {
    apCode: 'AP',
    apTitle: 'T',
    oltCode: null,
    oltTitle: null,
    slot: 1,
    port: 2,
    splitterCode: 'S1',
    splitterTitle: 'ST',
  },
  {
    apCode: 'AP2',
    apTitle: 'T2',
    oltCode: null,
    oltTitle: null,
    slot: 3,
    port: 4,
    splitterCode: 'S2',
    splitterTitle: 'ST2',
  },
])

function sel(connections: MassivaLocalPreviewRouteSelection['connections']): MassivaLocalPreviewRouteSelection {
  return { connections }
}

describe('resolveEffectiveMassivaSplitterCodes', () => {
  it('retorna uniao de splitters efetivos em multiplas rotas', () => {
    expect(resolveEffectiveMassivaSplitterCodes(sel([]), catalog)).toEqual([])

    expect(
      resolveEffectiveMassivaSplitterCodes(
        sel([
          {
            apId: 'AP',
            apLabel: 'AP',
            slot: 1,
            porta: 2,
            splitters: [{ id: 'Z', label: 'Z' }, { id: 'Z', label: 'Z repetido' }],
          },
          {
            apId: 'AP2',
            apLabel: 'AP2',
            slot: 3,
            porta: 4,
            splitters: [],
          },
        ]),
        catalog,
      ),
    ).toEqual(['S2', 'Z'])
  })
})
