import { describe, expect, it } from 'vitest'
import { massivaClientDedupeKey } from '@/features/massiva/lib/massivaClientDedupeKey'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function c(partial: Partial<SplitterCliente> & Pick<SplitterCliente, 'authenticationId' | 'user'>): SplitterCliente {
  return {
    clientId: 1,
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
    isCorporate: false,
    contract: null,
    ...partial,
  }
}

describe('massivaClientDedupeKey', () => {
  it('usa auth quando id > 0; senão user normalizado', () => {
    expect(massivaClientDedupeKey(c({ authenticationId: 5, user: 'x' }))).toBe('auth:5')
    expect(massivaClientDedupeKey(c({ authenticationId: 0, user: '  AbC  ' }))).toBe('user:abc')
  })
})
