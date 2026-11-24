import { describe, expect, it } from 'vitest'
import {
  buildTopologyIndices,
  buildTopologyIndicesFromConnections,
  buildTopologyIndicesFromLookup,
} from '@/features/autoisp/lib/buildTopologyIndices'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { Splitter } from '@/features/splitters/model/splitter'
import type { MassivaRouteRow } from '@/features/massiva/api/fetchMassivaRoutesFromLocalDb'

function cliente(
  user: string,
  splitterCode: string | null,
  ap: { code: string; title: string; slotOlt: number; portOlt: number },
): SplitterCliente {
  return {
    clientId: 1,
    authenticationId: 1,
    user,
    name: '',
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    splitterCode,
    splitterTitle: null,
    address: null,
    accessPoint: ap,
    isCorporate: false,
    contract: null,
  }
}

describe('buildTopologyIndices', () => {
  it('buildTopologyIndicesFromConnections monta catálogo, títulos e rota por usuário', () => {
    const list = [
      cliente('User@Test', 'S1', {
        code: 'AP1',
        title: 'T1',
        slotOlt: 1,
        portOlt: 2,
      }),
      cliente('', 'S2', {
        code: 'AP1',
        title: 'T1',
        slotOlt: 1,
        portOlt: 2,
      }),
    ]
    const idx = buildTopologyIndicesFromConnections(list)
    expect(idx.apTitleByCode.AP1).toBe('T1')
    expect(idx.routeCatalog.AP1[1][2].has('S1')).toBe(true)
    expect(idx.routeCatalog.AP1[1][2].has('S2')).toBe(true)
    expect(idx.routeByUsername['user@test']?.ap).toBe('AP1')
  })

  it('buildTopologyIndices agrega via getClientesForSplitter', () => {
    const splitter = { code: 'X' } as Splitter
    const c = cliente('u', 'Y', {
      code: 'AP',
      title: 'T',
      slotOlt: 0,
      portOlt: 1,
    })
    const idx = buildTopologyIndices([splitter], () => [c])
    expect(idx.routeByUsername.u).toMatchObject({ ap: 'AP', splitterCode: 'Y' })
  })
})

describe('buildTopologyIndicesFromLookup', () => {
  const route = (over: Partial<MassivaRouteRow>): MassivaRouteRow => ({
    apCode: 'AP2',
    apTitle: 'Ponto 2',
    oltCode: null,
    oltTitle: 'OLT-B',
    slot: 3,
    port: 4,
    splitterCode: 'S9',
    splitterTitle: 'SPL',
    ...over,
  })

  it('rota por PPPoE vem das conexões consultadas; catálogo de ponlink vem das rotas distintas', () => {
    const idx = buildTopologyIndicesFromLookup(
      [cliente('u1', 'S1', { code: 'AP1', title: 'OLT-A / T1', slotOlt: 1, portOlt: 2 })],
      [route({})],
    )
    expect(idx.routeByUsername.u1).toMatchObject({ ap: 'AP1', slot: 1, port: 2, splitterCode: 'S1' })
    expect(idx.routeCatalog.AP2[3][4].has('S9')).toBe(true)
    expect(idx.routeCatalog.AP1[1][2].has('S1')).toBe(true)
  })

  it('título do AP vindo das conexões tem precedência; sem ele, compõe OLT / AP', () => {
    const idx = buildTopologyIndicesFromLookup(
      [cliente('u1', 'S1', { code: 'AP1', title: 'OLT-A / T1', slotOlt: 1, portOlt: 2 })],
      [route({ apCode: 'AP1', apTitle: 'T1-das-rotas' }), route({})],
    )
    expect(idx.apTitleByCode.AP1).toBe('OLT-A / T1')
    expect(idx.apTitleByCode.AP2).toBe('OLT-B / Ponto 2')
  })

  it('sem OLT usa só o título do AP; rotas sem AP/título são ignoradas', () => {
    const idx = buildTopologyIndicesFromLookup(
      [],
      [route({ oltTitle: null }), route({ apCode: '', apTitle: 'x' }), route({ apCode: 'AP3', apTitle: '' })],
    )
    expect(idx.apTitleByCode).toEqual({ AP2: 'Ponto 2' })
    expect(Object.keys(idx.routeCatalog)).toEqual(['AP2'])
  })

  it('sem conexões nem rotas devolve índices vazios (carregando ou falha)', () => {
    expect(buildTopologyIndicesFromLookup([], [])).toEqual({
      routeCatalog: {},
      routeByUsername: {},
      apTitleByCode: {},
    })
  })
})
