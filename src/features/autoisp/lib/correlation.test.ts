import { describe, expect, it } from 'vitest'
import {
  resolveRouteFromEvent,
  resolveRouteFromEventStandalone,
} from '@/features/autoisp/lib/correlation'
import type { AutoIspEvent } from '@/features/autoisp/model/autoIsp.types'
import type { TopologyIndices } from '@/features/autoisp/model/topology.types'

function emptyEvent(): AutoIspEvent {
  return {
    id: 1,
    eventType: 't',
    adminStatus: 'open',
    startAt: null,
    endAt: null,
    countOnus: 0,
    countCircuits: 0,
    resources: [],
  }
}

describe('correlation', () => {
  it('resolveRouteFromEvent por PPPoE (consenso) e por ponlink no catálogo', () => {
    const indices: TopologyIndices = {
      routeCatalog: {
        Z: { 7: { 2: new Set(['ONLY']) } },
      },
      routeByUsername: {
        'cliente@provedor.com': {
          ap: 'Z',
          slot: 7,
          port: 2,
          splitterCode: 'ONLY',
          username: 'cliente@provedor.com',
        },
      },
      apTitleByCode: {},
    }

    const byUser = resolveRouteFromEvent(
      {
        ...emptyEvent(),
        resources: [
          { ponlink: null, pppoeUsername: 'cliente@provedor.com', networkStatus: null, contractId: null, onuId: null },
        ],
      },
      indices,
    )
    expect(byUser).toMatchObject({ ap: 'Z', slot: 7, port: 2, splitterCode: 'ONLY' })

    const byPon = resolveRouteFromEvent(
      {
        ...emptyEvent(),
        resources: [
          { ponlink: 'ignored/7/2', pppoeUsername: null, networkStatus: null, contractId: null, onuId: null },
        ],
      },
      indices,
    )
    expect(byPon).toMatchObject({ ap: 'Z', slot: 7, port: 2, splitterCode: 'ONLY' })

    expect(resolveRouteFromEvent(emptyEvent(), indices)).toBeNull()
  })

  it('resolveRouteFromEventStandalone parseia ponlink com barra invertida', () => {
    const r = resolveRouteFromEventStandalone({
      ...emptyEvent(),
      resources: [
        {
          ponlink: 'OLT-A\\CAIXA/12/3',
          pppoeUsername: 'ppp',
          networkStatus: null,
          contractId: null,
          onuId: null,
        },
      ],
    })
    expect(r).toMatchObject({
      ap: 'OLT-A/CAIXA',
      slot: 12,
      port: 3,
      username: 'ppp',
    })
    expect(resolveRouteFromEventStandalone(emptyEvent())).toBeNull()
  })
})
