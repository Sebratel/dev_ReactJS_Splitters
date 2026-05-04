import { describe, expect, it } from 'vitest'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'
import {
  countCorporateResidentialBySplitterCode,
  inferAffectedResidentialCorporateFromSplitterInventory,
} from '@/features/massiva/lib/massivaAffectedSplitFromConnections'

function cliente(code: string, corporate: boolean): SplitterCliente {
  return {
    clientId: 0,
    authenticationId: 0,
    user: '',
    name: '',
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    isCorporate: corporate,
    splitterCode: code,
    splitterTitle: null,
    address: null,
    accessPoint: null,
    contract: null,
  }
}

describe('massivaAffectedSplitFromConnections', () => {
  it('conta corporativo e residencial por splitter', () => {
    const map = countCorporateResidentialBySplitterCode([
      cliente('SP-1', false),
      cliente('SP-1', false),
      cliente('SP-1', true),
      cliente('SP-2', true),
    ])
    expect(map.get('SP-1')).toEqual({ residential: 2, corporate: 1 })
    expect(map.get('SP-2')).toEqual({ residential: 0, corporate: 1 })
  })

  it('usa inventário completo quando n ≥ total no splitter', () => {
    expect(
      inferAffectedResidentialCorporateFromSplitterInventory(10, {
        residential: 7,
        corporate: 3,
      }),
    ).toEqual({ residential: 7, corporate: 3 })
  })

  it('reparte proporcionalmente quando impacto parcial', () => {
    expect(
      inferAffectedResidentialCorporateFromSplitterInventory(4, {
        residential: 7,
        corporate: 1,
      }),
    ).toEqual({ residential: 3, corporate: 1 })
  })
})
