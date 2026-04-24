import { describe, expect, it } from 'vitest'
import { filterConnectionsBySplitterCode } from '@/features/massiva/lib/filterConnectionsBySplitterCode'
import type { SplitterCliente } from '@/features/splitters/model/splitterCliente'

function cx(
  splitterCode: string | null,
  splitterTitle: string | null,
): SplitterCliente {
  return {
    clientId: 1,
    authenticationId: 1,
    user: 'u',
    name: '',
    phone: null,
    email: null,
    status: 0,
    port: null,
    blocked: false,
    blockedDescription: null,
    splitterCode,
    splitterTitle,
    address: null,
    accessPoint: null,
    isCorporate: false,
    contract: null,
  }
}

describe('filterConnectionsBySplitterCode', () => {
  it('retorna vazio para codigo vazio', () => {
    expect(filterConnectionsBySplitterCode([cx('A', null)], '  ')).toEqual([])
  })

  it('combina apenas codigo/titulo exatos normalizados (sem includes)', () => {
    const list = [
      cx('SP-01', null),
      cx(null, 'SP 01'),
      cx('x', 'prefixosp01suffix'),
    ]
    expect(filterConnectionsBySplitterCode(list, 'SP-01')).toHaveLength(2)
  })
})
