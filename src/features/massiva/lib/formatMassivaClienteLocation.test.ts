import { describe, expect, it } from 'vitest'
import { formatMassivaClienteLocationLine, hasMassivaClienteMapCoords } from '@/features/massiva/lib/formatMassivaClienteLocation'
import type { ClienteAddress, SplitterCliente } from '@/features/splitters/model/splitterCliente'

function addr(over: Partial<ClienteAddress>): ClienteAddress {
  return {
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    postalCode: '',
    complement: null,
    latitude: null,
    longitude: null,
    ...over,
  }
}

function c(over: Partial<SplitterCliente> & Pick<SplitterCliente, 'authenticationId' | 'user'>): SplitterCliente {
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
    ...over,
  }
}

describe('formatMassivaClienteLocationLine', () => {
  it('retorna em dash sem endereço', () => {
    expect(formatMassivaClienteLocationLine(c({ authenticationId: 1, user: 'a' }))).toBe('—')
  })

  it('monta rua, bairro e cidade/estado', () => {
    const line = formatMassivaClienteLocationLine(
      c({
        authenticationId: 1,
        user: 'a',
        address: addr({
          street: 'Rua A',
          number: '10',
          neighborhood: 'Centro',
          city: 'SP',
          state: 'SP',
        }),
      }),
    )
    expect(line).toBe('Rua A, 10 · Centro · SP / SP')
  })

  it('sem rua, usa complemento quando existir', () => {
    expect(
      formatMassivaClienteLocationLine(
        c({
          authenticationId: 1,
          user: 'a',
          address: addr({ complement: 'Bloco B' }),
        }),
      ),
    ).toBe('Bloco B')
  })
})

describe('hasMassivaClienteMapCoords', () => {
  it('rejeita nulos ou fora de faixa', () => {
    expect(hasMassivaClienteMapCoords(c({ authenticationId: 1, user: 'a' }))).toBe(false)
    expect(
      hasMassivaClienteMapCoords(
        c({ authenticationId: 1, user: 'a', address: addr({ latitude: -15, longitude: 200 }) }),
      ),
    ).toBe(false)
  })

  it('aceita lat/lng finitos na faixa', () => {
    expect(
      hasMassivaClienteMapCoords(
        c({ authenticationId: 1, user: 'a', address: addr({ latitude: -15.2, longitude: -47.8 }) }),
      ),
    ).toBe(true)
  })
})
