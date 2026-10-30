import { describe, expect, it } from 'vitest'
import type { MassivaRouteRow } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'
import { emptyEscopoRede } from '@/features/gmud/model/gmudEscopoRede'
import { buildEscopoRedeOptions, pruneEscopoRede, routesForSite } from '@/features/gmud/lib/gmudEscopoRedeOptions'

const row = (over: Partial<MassivaRouteRow>): MassivaRouteRow => ({
  apCode: 'AP-1',
  apTitle: 'OLT 01',
  siteTitle: 'NHOPN',
  oltCode: null,
  oltTitle: null,
  slot: 1,
  port: 1,
  splitterCode: 'S1',
  splitterTitle: 'SPL 1',
  ...over,
})

const rows: MassivaRouteRow[] = [
  row({ slot: 1, port: 1, splitterCode: 'S1', splitterTitle: 'SPL 1' }),
  row({ slot: 1, port: 2, splitterCode: 'S2', splitterTitle: 'SPL 2' }),
  row({ slot: 2, port: 4, splitterCode: 'S3', splitterTitle: 'SPL 3' }),
  row({ apCode: 'AP-2', apTitle: 'OLT 02', slot: 1, port: 1, splitterCode: 'S9', splitterTitle: 'SPL 9' }),
  row({ siteTitle: 'OUTRO', apCode: 'AP-X', apTitle: 'OLT X', splitterCode: 'SX', splitterTitle: 'SPL X' }),
]

describe('rotas do site', () => {
  it('filtra pelo POP/Site sem diferenciar caixa nem espaços', () => {
    const doSite = routesForSite(rows, '  nhopn ')
    expect(doSite).toHaveLength(4)
    expect(routesForSite(rows, '')).toEqual([])
    expect(routesForSite(rows, 'INEXISTENTE')).toEqual([])
  })
})

describe('cascata ponto de acesso → slot → PON → splitter', () => {
  const doSite = routesForSite(rows, 'NHOPN')

  it('sem ponto de acesso só lista os pontos de acesso do site', () => {
    const o = buildEscopoRedeOptions(doSite, emptyEscopoRede())
    expect(o.aps.map((a) => a.code)).toEqual(['AP-1', 'AP-2'])
    expect(o.slots).toEqual([])
    expect(o.splitters).toEqual([])
  })

  it('com o ponto de acesso lista slots e todos os splitters dele', () => {
    const o = buildEscopoRedeOptions(doSite, { ...emptyEscopoRede(), apCode: 'AP-1' })
    expect(o.slots).toEqual([1, 2])
    expect(o.ports).toEqual([])
    expect(o.splitters.map((s) => s.code)).toEqual(['S1', 'S2', 'S3'])
  })

  it('com o slot lista as PONs e restringe os splitters ao slot', () => {
    const o = buildEscopoRedeOptions(doSite, { ...emptyEscopoRede(), apCode: 'AP-1', slot: 1 })
    expect(o.ports).toEqual([1, 2])
    expect(o.splitters.map((s) => s.code)).toEqual(['S1', 'S2'])
  })

  it('com as PONs marcadas restringe os splitters a elas', () => {
    const o = buildEscopoRedeOptions(doSite, { ...emptyEscopoRede(), apCode: 'AP-1', slot: 1, ports: [2] })
    expect(o.splitters.map((s) => s.code)).toEqual(['S2'])
  })

  it('remove da escolha PON e splitter que saíram do recorte', () => {
    const escopo = {
      ...emptyEscopoRede(),
      apCode: 'AP-1',
      slot: 2,
      ports: [1, 4],
      splitters: [{ code: 'S1', title: 'SPL 1' }, { code: 'S3', title: 'SPL 3' }],
    }
    const pruned = pruneEscopoRede(escopo, buildEscopoRedeOptions(doSite, escopo))
    expect(pruned.ports).toEqual([4])
    expect(pruned.splitters.map((s) => s.code)).toEqual(['S3'])
  })
})
