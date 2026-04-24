import { describe, expect, it } from 'vitest'
import {
  buildTopologyIndices,
  buildTopologyIndicesFromConnections,
} from '@/features/autoisp/lib/buildTopologyIndices'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import type { Splitter } from '@/features/splitters/model/splitter'

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
