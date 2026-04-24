import { describe, expect, it } from 'vitest'
import { buildMassivaRouteCatalogFromRows } from '@/features/massiva/lib/buildMassivaRouteCatalog'
import { getMassivaRouteSelectionIssues } from '@/features/massiva/lib/validateMassivaRouteSelection'
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
])

function sel(connections: MassivaLocalPreviewRouteSelection['connections']): MassivaLocalPreviewRouteSelection {
  return { connections }
}

describe('getMassivaRouteSelectionIssues', () => {
  it('encadeia validacoes por rota (AP, slot, porta e splitters)', () => {
    expect(getMassivaRouteSelectionIssues(sel([]), 0, catalog)[0]).toContain('pontos de acesso')
    expect(getMassivaRouteSelectionIssues(sel([]), 1, catalog)[0]).toContain('Adicione ao menos')

    expect(
      getMassivaRouteSelectionIssues(
        sel([{ apId: 'AP', apLabel: 'AP', slot: null, porta: 2, splitters: [] }]),
        1,
        catalog,
      )[0],
    ).toContain('slot')

    expect(
      getMassivaRouteSelectionIssues(
        sel([{ apId: 'AP', apLabel: 'AP', slot: 1, porta: null, splitters: [] }]),
        1,
        catalog,
      )[0],
    ).toContain('porta')

    expect(
      getMassivaRouteSelectionIssues(
        sel([{ apId: 'AP', apLabel: 'AP', slot: 1, porta: 99, splitters: [] }]),
        1,
        catalog,
      )[0],
    ).toContain('nenhum splitter')

    expect(
      getMassivaRouteSelectionIssues(
        sel([{ apId: 'AP', apLabel: 'AP', slot: 1, porta: 2, splitters: [] }]),
        1,
        catalog,
      ),
    ).toEqual([])
  })
})
