import { describe, expect, it } from 'vitest'
import {
  occupancyBandForNeighbor,
  occupancyBandForUsage,
} from '@/features/splitters/lib/splitterNeighborOccupancyBand'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function c(code: string): SplitterCliente {
  return {
    clientId: 1,
    authenticationId: 1,
    user: 'u',
    name: 'n',
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    splitterCode: code,
    splitterTitle: null,
    address: null,
    accessPoint: null,
    isCorporate: false,
    contract: null,
  }
}

describe('splitterNeighborOccupancyBand', () => {
  it('occupancyBandForUsage', () => {
    expect(occupancyBandForUsage(0, 0)).toBe('unknown')
    expect(occupancyBandForUsage(5, 10)).toBe('ok')
    expect(occupancyBandForUsage(7, 10)).toBe('warning')
    expect(occupancyBandForUsage(9, 10)).toBe('critical')
  })

  it('occupancyBandForNeighbor', () => {
    expect(occupancyBandForNeighbor('S', 8, undefined)).toBe('unknown')
    expect(
      occupancyBandForNeighbor(
        'S',
        8,
        Array.from({ length: 7 }, () => c('S')),
      ),
    ).toBe('warning')
  })
})
