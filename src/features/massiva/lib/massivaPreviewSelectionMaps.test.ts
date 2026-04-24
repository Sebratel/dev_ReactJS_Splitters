import { describe, expect, it } from 'vitest'
import {
  massivaPreviewNormalizedRoutes,
  massivaPreviewSelectedAps,
  massivaPreviewSelectionToExplicitSplitters,
  massivaPreviewSelectionToPortsByApSlot,
} from '@/features/massiva/lib/massivaPreviewSelectionMaps'
import type { MassivaLocalPreviewRouteSelection } from '@/features/massiva/model/massivaLocalPreview'

function selection(connections: MassivaLocalPreviewRouteSelection['connections']): MassivaLocalPreviewRouteSelection {
  return { connections }
}

describe('massivaPreviewSelectionMaps', () => {
  it('normaliza e deduplica rotas completas', () => {
    const normalized = massivaPreviewNormalizedRoutes(
      selection([
        { apId: '', apLabel: '', slot: null, porta: null, splitters: [] },
        { apId: ' AP1 ', apLabel: 'AP1', slot: 1, porta: 2, splitters: [] },
        { apId: 'AP1', apLabel: 'AP1', slot: 1, porta: 2, splitters: [] },
      ]),
    )

    expect(normalized).toEqual([
      {
        apCode: 'AP1',
        slot: 1,
        port: 2,
        splitterCodes: [],
      },
    ])
  })

  it('massivaPreviewSelectedAps', () => {
    expect(massivaPreviewSelectedAps(selection([]))).toEqual([])
    expect(
      massivaPreviewSelectedAps(
        selection([
          { apId: ' AP1 ', apLabel: 'AP1', slot: 1, porta: 2, splitters: [] },
          { apId: 'AP2', apLabel: 'AP2', slot: 3, porta: 4, splitters: [] },
        ]),
      ),
    ).toEqual(['AP1', 'AP2'])
  })

  it('massivaPreviewSelectionToPortsByApSlot', () => {
    const empty = massivaPreviewSelectionToPortsByApSlot(
      selection([{ apId: '', apLabel: '', slot: 1, porta: 2, splitters: [] }]),
    )
    expect(empty.size).toBe(0)

    const map = massivaPreviewSelectionToPortsByApSlot(
      selection([{ apId: 'A', apLabel: 'A', slot: 1, porta: 2, splitters: [] }]),
    )
    expect(map.get('A')?.get(1)?.has(2)).toBe(true)
  })

  it('massivaPreviewSelectionToExplicitSplitters', () => {
    expect(
      massivaPreviewSelectionToExplicitSplitters(
        selection([{ apId: 'A', apLabel: 'A', slot: 1, porta: 2, splitters: [] }]),
      ),
    ).toBeUndefined()

    const explicit = massivaPreviewSelectionToExplicitSplitters(
      selection([
        {
          apId: 'A',
          apLabel: 'A',
          slot: 1,
          porta: 2,
          splitters: [{ id: ' x ', label: 'X' }, { id: '', label: '' }],
        },
      ]),
    )

    expect(explicit?.get('A')?.get(1)?.get(2)?.has('x')).toBe(true)
  })
})
