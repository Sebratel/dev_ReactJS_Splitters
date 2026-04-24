import { describe, expect, it } from 'vitest'
import { massivaPreviewTotalsFromClientes } from '@/features/massiva/lib/massivaPreviewTotalsFromClientes'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function u(user: string, isCorporate = false): SplitterCliente {
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
    splitterCode: null,
    splitterTitle: null,
    address: null,
    accessPoint: null,
    isCorporate,
    contract: null,
  }
}

describe('massivaPreviewTotalsFromClientes', () => {
  it('conta afetados e PPPoEs únicos (case-insensitive)', () => {
    expect(
      massivaPreviewTotalsFromClientes([u('a'), u('A'), u('  b  ')]),
    ).toEqual({
      totalAffected: 3,
      totalPppoes: 2,
      totalCorporateAffected: 0,
    })
  })

  it('conta clientes corporativos na lista (isCorporate)', () => {
    expect(
      massivaPreviewTotalsFromClientes([u('a@x', true), u('b@x', true), u('c@x', false)]),
    ).toEqual({
      totalAffected: 3,
      totalPppoes: 3,
      totalCorporateAffected: 2,
    })
  })
})
